import { AriaLabelingProps, FocusableDOMProps, FocusableProps, InputBase, InputDOMProps, RefObject } from '@react-types/shared';
import { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { ToggleState } from 'react-stately/useToggleState';
export interface SwitchProps extends InputBase, FocusableProps {
    /**
     * The content to render as the Switch's label.
     */
    children?: ReactNode;
    /**
     * Whether the Switch should be selected (uncontrolled).
     */
    defaultSelected?: boolean;
    /**
     * Whether the Switch should be selected (controlled).
     */
    isSelected?: boolean;
    /**
     * Handler that is called when the Switch's selection state changes.
     */
    onChange?: (isSelected: boolean) => void;
    /**
     * The value of the input element, used when submitting an HTML form. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#htmlattrdefvalue).
     */
    value?: string;
}
export interface AriaSwitchProps extends SwitchProps, FocusableDOMProps, InputDOMProps, AriaLabelingProps {
    /**
     * Identifies the element (or elements) whose contents or presence are controlled by the current element.
     */
    'aria-controls'?: string;
}
export interface SwitchAria {
    /** Props for the label wrapper element. */
    labelProps: LabelHTMLAttributes<HTMLLabelElement>;
    /** Props for the input element. */
    inputProps: InputHTMLAttributes<HTMLInputElement>;
    /** Whether the switch is selected. */
    isSelected: boolean;
    /** Whether the switch is in a pressed state. */
    isPressed: boolean;
    /** Whether the switch is disabled. */
    isDisabled: boolean;
    /** Whether the switch is read only. */
    isReadOnly: boolean;
}
/**
 * Provides the behavior and accessibility implementation for a switch component.
 * A switch is similar to a checkbox, but represents on/off values as opposed to selection.
 * @param props - Props for the switch.
 * @param state - State for the switch, as returned by `useToggleState`.
 * @param ref - Ref to the HTML input element.
 */
export declare function useSwitch(props: AriaSwitchProps, state: ToggleState, ref: RefObject<HTMLInputElement | null>): SwitchAria;
