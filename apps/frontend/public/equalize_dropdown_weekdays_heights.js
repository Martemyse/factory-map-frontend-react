document.addEventListener('DOMContentLoaded', function() {

    // Throttle/flag to prevent repeated calls in quick succession
    let resizingInProgress = false;
    let resizeTimeout = null;

    // Main function: unify heights for a given machine_group_id once all 
    // "weekdays-dropdown" for that machine_group_id are present.
    function unifyHeightsForMachineGroup(mgId) {
        const allDropdowns = document.querySelectorAll('[id*="\\\"type\\\"\\:\\\"weekdays-dropdown\\\""]');
        const allHeaders = document.querySelectorAll('[id*="\\\"type\\\"\\:\\\"weekdays-dropdown-header-div\\\""]');
        const groups = {};

        function processElement(el, isHeader) {
            try {
                const parsedId = JSON.parse(el.id);
                const mg_id = parsedId.machine_group_id;
                const izmena = parsedId.izmena || "";
                const dayIndex = parsedId.day_index || -1;

                // Exclude header-div with day_index=0
                if (isHeader && dayIndex === 0) return;

                if (mg_id === mgId && izmena !== undefined) {
                    const key = mg_id + "_" + izmena;
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(el);
                }
            } catch (e) {
                // ignore
            }
        }

        // Collect elements specifically for this mgId
        allDropdowns.forEach(el => processElement(el, false));
        allHeaders.forEach(el => processElement(el, true));

        // For each group in that mgId, unify heights
        Object.keys(groups).forEach(key => {
            const elements = groups[key];
            let maxHeight = 0;
            elements.forEach(el => {
                const h = el.offsetHeight;
                if (h > maxHeight) maxHeight = h;
            });
            elements.forEach(el => {
                el.style.height = maxHeight + 'px';
            });
        });
    }

    // We call this each time a new node is added/removed, 
    // but we throttle so it won't run too often.
    function checkAndUnifyHeights() {
        if (resizingInProgress) return;  // skip if we're already scheduled
        resizingInProgress = true;

        // Wait a short moment (e.g. 100 ms) in case multiple changes happen at once.
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizingInProgress = false;
            resizeTimeout = null;

            // 1) Find all machine_group_ids currently in the DOM
            const mgIds = new Set();
            const allDropdowns = document.querySelectorAll('[id*="\\\"type\\\"\\:\\\"weekdays-dropdown\\\""]');
            allDropdowns.forEach(el => {
                try {
                    const parsedId = JSON.parse(el.id);
                    const mg_id = parsedId.machine_group_id;
                    if (mg_id !== undefined) mgIds.add(mg_id);
                } catch(e) {
                    // ignore
                }
            });

            // 2) For each machine_group_id, unify
            mgIds.forEach(mgId => {
                unifyHeightsForMachineGroup(mgId);
            });
        }, 100);
    }

    // 1) Run once after DOM is loaded
    checkAndUnifyHeights();

    // 2) Also run on window resize
    window.addEventListener('resize', checkAndUnifyHeights);

    // 3) Observe DOM changes to detect if new dropdowns appear
    const observer = new MutationObserver(() => {
        checkAndUnifyHeights();
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
