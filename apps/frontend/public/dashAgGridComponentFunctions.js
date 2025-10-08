var dagcomponentfuncs = (window.dashAgGridComponentFunctions = window.dashAgGridComponentFunctions || {});

dagcomponentfuncs.pdfLinkRenderer = function (props) {
    // Check if props.value is truthy and not "NaN", "None", or an empty string
    if (props.value && props.value !== "NaN" && props.value !== "None" && props.value !== "") {
        try {
            // Create a URL object from props.value to easily extract parts of the URL
            var url = new URL(props.value);
            // Extract the pathname from the URL and then take only the filename part
            var filename = url.pathname.split('/').pop();
            // Use the filename as the link text
            return React.createElement(
                'a',
                { href: props.value, target: '_blank' },
                decodeURIComponent(filename) // Decoding the URI component to handle spaces and other encoded characters
            );
        } catch (e) {
            console.error("Error creating URL object:", e);
            // Return the raw value or a placeholder if URL creation fails
            return props.value || "Invalid URL";
        }
    } else {
        // If props.value is falsy or not a valid link, just return it as is or a placeholder
        return props.value || "No link available";
    }
}



dagcomponentfuncs.partialBoldRenderer = function(props) {
    if (props.value && typeof props.value === 'string') {
        var parts = props.value.split(' ');
        if (parts.length > 1) {
            var timePart = parts[0];
            var rest = props.value.substring(timePart.length);
            return React.createElement(
                'span',
                null,
                React.createElement('b', null, timePart),
                rest
            );
        }
        return props.value;
    }
    return "";
};