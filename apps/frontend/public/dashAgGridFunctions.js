var dagfuncs = window.dashAgGridFunctions = window.dashAgGridFunctions || {};

var dropdownRequest = async (params) => {
    resp = await fetch('./dynamicOptions', {method: 'POST', headers: {'content-type': 'application/json'}, 'body': JSON.stringify(params.node.data)})
    .then(resp => resp.json())
    .then((data) => {return data})
    return resp
}

dagfuncs.DMC_Select2 = class {
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

        // renders component into the editor element - dynamically requests data from the server
        dropdownRequest(params).then((data) => {
        ReactDOM.render(
            React.createElement(window.dash_mantine_components.Select, {
                data: data,
                value: params.value,
                setProps,
                style: {width: params.column.actualWidth-2,  ...params.style},
                className: params.className,
                clearable: params.clearable,
                searchable: params.searchable || true,
                creatable: params.creatable,
                debounce: params.debounce,
                disabled: params.disabled,
                filterDataOnExactSearchMatch:
                    params.filterDataOnExactSearchMatch,
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
        })

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
        // Delay to allow the component to render
        setTimeout(() => {
            const inputs = this.eInput.querySelectorAll('input, select, textarea, [tabindex]');
            if (inputs.length > 0) {
                // Focus on the first focusable element found
                inputs[0].focus();
    
                // Optionally disable keyboard event handling in the grid while editing
                this.params.colDef.suppressKeyboardEvent = (params) => {
                    return params.editing;
                };
            }
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