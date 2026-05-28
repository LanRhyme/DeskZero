var $da48c5f79caabf8f$exports = require("../toggle/useToggle.cjs");
var $89b39774f3b79dbb$exports = require("../utils/mergeProps.cjs");
var $2dfbb9cb434f8768$exports = require("../form/useFormValidation.cjs");
var $1d003dcb6308cd89$exports = require("../interactions/usePress.cjs");
var $3sOAT$react = require("react");
var $3sOAT$reactstatelyprivateformuseFormValidationState = require("react-stately/private/form/useFormValidationState");


function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

$parcel$export(module.exports, "useCheckbox", function () { return $92a2bffa21a60742$export$e375f10ce42261c5; });
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */ 





function $92a2bffa21a60742$export$e375f10ce42261c5(props, state, inputRef) {
    // Create validation state here because it doesn't make sense to add to general useToggleState.
    let validationState = (0, $3sOAT$reactstatelyprivateformuseFormValidationState.useFormValidationState)({
        ...props,
        value: state.isSelected
    });
    let { isInvalid: isInvalid, validationErrors: validationErrors, validationDetails: validationDetails } = validationState.displayValidation;
    let { labelProps: labelProps, inputProps: inputProps, isSelected: isSelected, isPressed: isPressed, isDisabled: isDisabled, isReadOnly: isReadOnly } = (0, $da48c5f79caabf8f$exports.useToggle)({
        ...props,
        isInvalid: isInvalid
    }, state, inputRef);
    (0, $2dfbb9cb434f8768$exports.useFormValidation)(props, validationState, inputRef);
    let { isIndeterminate: isIndeterminate, isRequired: isRequired, validationBehavior: validationBehavior = 'aria' } = props;
    (0, $3sOAT$react.useEffect)(()=>{
        // indeterminate is a property, but it can only be set via javascript
        // https://css-tricks.com/indeterminate-checkboxes/
        if (inputRef.current) inputRef.current.indeterminate = !!isIndeterminate;
    });
    // Reset validation state on label press for checkbox with a hidden input.
    let { pressProps: pressProps } = (0, $1d003dcb6308cd89$exports.usePress)({
        isDisabled: isDisabled || isReadOnly,
        onPress () {
            // @ts-expect-error
            let { [(0, $3sOAT$reactstatelyprivateformuseFormValidationState.privateValidationStateProp)]: groupValidationState } = props;
            let { commitValidation: commitValidation } = groupValidationState ? groupValidationState : validationState;
            commitValidation();
        }
    });
    return {
        labelProps: (0, $89b39774f3b79dbb$exports.mergeProps)(labelProps, pressProps, (0, $3sOAT$react.useMemo)(()=>({
                // Prevent label from being focused when mouse down on it.
                // Note, this does not prevent the input from being focused in the `click` event.
                onMouseDown: (e)=>e.preventDefault()
            }), [])),
        inputProps: {
            ...inputProps,
            checked: isSelected,
            'aria-required': isRequired && validationBehavior === 'aria' || undefined,
            required: isRequired && validationBehavior === 'native'
        },
        isSelected: isSelected,
        isPressed: isPressed,
        isDisabled: isDisabled,
        isReadOnly: isReadOnly,
        isInvalid: isInvalid,
        validationErrors: validationErrors,
        validationDetails: validationDetails
    };
}


//# sourceMappingURL=useCheckbox.cjs.map
