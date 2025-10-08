// Make sure these exist:
var dagfuncs = window.dashAgGridFunctions = window.dashAgGridFunctions || {};

// =======================
// 1) Custom Cell Editor
// =======================
// cell editor custom component  - dmc.MultiSelect
dagfuncs.DMC_MultiSelect = class {
    // gets called once before the renderer is used
    init(params) {
        // create the cell
        this.params = params;

        // function for when Dash is trying to send props back to the component / server
        var setProps = (props) => {
            if (typeof props.value != typeof undefined) {
                // updates the value of the editor
                this.value = props.value;

                // re-enables keyboard event
                delete params.colDef.suppressKeyboardEvent;

                // tells the grid to stop editing the cell
                params.api.stopEditing();

                // sets focus back to the grid's previously active cell
                this.prevFocus.focus();
            }
        };
        this.eInput = document.createElement('div');

        // renders component into the editor element
        ReactDOM.render(
            React.createElement(window.dash_mantine_components.MultiSelect, {
                data: params.options,
                value: params.value,
                setProps,
                style: {width: params.column.actualWidth-2,  ...params.style},
                className: params.className,
                clearable: params.clearable,
                searchable: params.searchable || true,
                creatable: params.creatable,
                debounce: params.debounce,
                disabled: params.disabled,
                limit: params.limit,
                maxDropdownHeight: params.maxDropdownHeight,
                nothingFound: params.nothingFound,
                placeholder: params.placeholder,
                required: params.required,
                searchValue: params.searchValue,
                shadow: params.shadow,
                size: params.size,
                styles: params.styles,
                switchDirectionOnFlip: params.switchDirectionOnFlip,
                variant: params.variant,
            }),
            this.eInput
        );

        // allows focus event
        this.eInput.tabIndex = '0';

        // sets editor value to the value from the cell
        this.value = params.value;
    }

    // gets called once when grid ready to insert the element
    getGui() {
        return this.eInput;
    }

    focusChild() {
        // needed to delay and allow the component to render
        setTimeout(() => {
            var inp = this.eInput.getElementsByClassName(
                'mantine-MultiSelect-input'
            )[0];
            inp.tabIndex = '1';

            // disables keyboard event
            this.params.colDef.suppressKeyboardEvent = (params) => {
                const gridShouldDoNothing = params.editing;
                return gridShouldDoNothing;
            };
            // shows dropdown options
            inp.focus();
        }, 100);
    }

    // focus and select can be done after the gui is attached
    afterGuiAttached() {
        // stores the active cell
        this.prevFocus = document.activeElement;

        // adds event listener to trigger event to go into dash component
        this.eInput.addEventListener('focus', this.focusChild());

        // triggers focus event
        this.eInput.focus();
    }

    // returns the new value after editing
    getValue() {
        return this.value;
    }

    // any cleanup we need to be done here
    destroy() {
        // sets focus back to the grid's previously active cell
        this.prevFocus.focus();
    }
};
// =======================
// 2) Custom Cell Renderer
// =======================
dagfuncs.renderTags = function (params) {
    const tags = params.value || [];
    const colorMap = params.colorMap || {};

    // Create a container <div> for badges/pills
    const eDiv = document.createElement('div');
    eDiv.style.display = 'flex';
    eDiv.style.flexWrap = 'wrap';
    eDiv.style.gap = '4px';

    tags.forEach((tag) => {
        const eTag = document.createElement('span');
        eTag.innerText = tag;
        eTag.style.padding = '2px 6px';
        eTag.style.borderRadius = '4px';
        eTag.style.fontSize = '0.8rem';
        eTag.style.backgroundColor = colorMap[tag] || '#eee';
        eTag.style.color = '#000';
        eDiv.appendChild(eTag);
    });
    return eDiv;
};
