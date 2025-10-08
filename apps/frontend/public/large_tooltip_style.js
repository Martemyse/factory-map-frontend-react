window.setInterval(function() {
    let tooltip = document.querySelector('.dash-table-tooltip');
    if (tooltip) {
        // Ensure the tooltip can receive mouse events
        tooltip.style.pointerEvents = 'auto';

        // Find the cell that triggered the tooltip
        let cell = tooltip.closest('.dash-cell, td, th');

        // Only proceed if the cell is found
        if (cell) {
            // Create a flag to track if the cursor is over the cell or tooltip
            let isHovering = false;

            // Function to show the tooltip
            function showTooltip() {
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
            }

            // Function to hide the tooltip
            function hideTooltip() {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            }

            // Add event listeners to the cell
            if (!cell.classList.contains('tooltip-listeners-added')) {
                cell.addEventListener('mouseenter', function() {
                    isHovering = true;
                    showTooltip();
                });

                cell.addEventListener('mouseleave', function() {
                    isHovering = false;
                    // Delay hiding to allow moving to tooltip
                    setTimeout(function() {
                        if (!isHovering) hideTooltip();
                    }, 100);
                });

                cell.classList.add('tooltip-listeners-added');
            }
        }

        // Add event listeners to the tooltip itself
        if (!tooltip.classList.contains('tooltip-listeners-added')) {
            tooltip.addEventListener('mouseenter', function() {
                isHovering = true;
                showTooltip();
            });

            tooltip.addEventListener('mouseleave', function() {
                isHovering = false;
                // Delay hiding to allow moving back to cell
                setTimeout(function() {
                    if (!isHovering) hideTooltip();
                }, 100);
            });

            tooltip.classList.add('tooltip-listeners-added');
        }

        // Adjust the tooltip position only once
        if (!tooltip.classList.contains('tooltip-position-adjusted')) {
            // Get viewport dimensions
            let viewportHeight = window.innerHeight;
            let viewportWidth = window.innerWidth;

            // Get tooltip dimensions and position
            let tooltipRect = tooltip.getBoundingClientRect();

            // Compute the required adjustments
            let offsetTop = 0;
            let offsetLeft = 0;

            // Adjust vertically if tooltip overflows
            if (tooltipRect.top < 0) {
                offsetTop = -tooltipRect.top + 10; // Move down
            } else if (tooltipRect.bottom > viewportHeight) {
                offsetTop = viewportHeight - tooltipRect.bottom - 10; // Move up
            }

            // Adjust horizontally if tooltip overflows
            if (tooltipRect.left < 0) {
                offsetLeft = -tooltipRect.left + 10; // Move right
            } else if (tooltipRect.right > viewportWidth) {
                offsetLeft = viewportWidth - tooltipRect.right - 10; // Move left
            }

            // Apply adjustments
            if (offsetTop !== 0 || offsetLeft !== 0) {
                tooltip.style.transform = `translate(${offsetLeft}px, ${offsetTop}px)`;
            }

            tooltip.classList.add('tooltip-position-adjusted');
        }
    }
}, 250);
