window.addEventListener("beforeprint", function () {
    const isLeanteams = document.getElementById("leanteams_content");

    if (isLeanteams) {
        const style = document.createElement("style");
        style.id = "leanteams-print-style";
        style.innerHTML = `
            @page {
                size: A4 portrait;
            }

            body {
                zoom: 0.6;
                transform-origin: top left;
            }
        `;
        document.head.appendChild(style);
    }
});

window.addEventListener("afterprint", function () {
    const existingStyle = document.getElementById("leanteams-print-style");
    if (existingStyle) {
        existingStyle.remove();
    }
});
