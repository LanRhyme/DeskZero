var $8b8d004404afcaba$exports = require("./utils.cjs");
var $e247a673010dfa8e$exports = require("./useCalendarState.cjs");
var $14cedf286405cc4b$exports = require("../utils/useControlledState.cjs");
var $9FN09$internationalizeddate = require("@internationalized/date");
var $9FN09$react = require("react");


function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

$parcel$export(module.exports, "useRangeCalendarState", function () { return $9e947abe92c47a22$export$9a987164d97ecc90; });
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




function $9e947abe92c47a22$export$9a987164d97ecc90(props) {
    let { value: valueProp, defaultValue: defaultValue, onChange: onChange, createCalendar: createCalendar, locale: locale, visibleDuration: visibleDuration = {
        months: 1
    }, minValue: minValue, maxValue: maxValue, ...calendarProps } = props;
    let [value, setValue] = (0, $14cedf286405cc4b$exports.useControlledState)(valueProp, defaultValue || null, onChange);
    let [anchorDate, setAnchorDateState] = (0, $9FN09$react.useState)(null);
    let alignment = 'center';
    if (value && value.start && value.end) {
        let start = (0, $8b8d004404afcaba$exports.alignCenter)((0, $9FN09$internationalizeddate.toCalendarDate)(value.start), visibleDuration, locale, minValue, maxValue);
        let end = start.add(visibleDuration).subtract({
            days: 1
        });
        if (value.end.compare(end) > 0) alignment = 'start';
    }
    // Available range must be stored in a ref so we have access to the updated version immediately in `isInvalid`.
    let availableRangeRef = (0, $9FN09$react.useRef)(null);
    let [availableRange, setAvailableRange] = (0, $9FN09$react.useState)(null);
    let min = (0, $9FN09$react.useMemo)(()=>(0, $9FN09$internationalizeddate.maxDate)(minValue, availableRange?.start), [
        minValue,
        availableRange
    ]);
    let max = (0, $9FN09$react.useMemo)(()=>(0, $9FN09$internationalizeddate.minDate)(maxValue, availableRange?.end), [
        maxValue,
        availableRange
    ]);
    let calendar = (0, $e247a673010dfa8e$exports.useCalendarState)({
        ...calendarProps,
        value: value && value.start,
        createCalendar: createCalendar,
        locale: locale,
        visibleDuration: visibleDuration,
        minValue: min,
        maxValue: max,
        selectionAlignment: props.selectionAlignment || alignment
    });
    let updateAvailableRange = (date)=>{
        if (date && props.isDateUnavailable && !props.allowsNonContiguousRanges) {
            const nextAvailableStartDate = $9e947abe92c47a22$var$nextUnavailableDate(date, calendar, -1);
            const nextAvailableEndDate = $9e947abe92c47a22$var$nextUnavailableDate(date, calendar, 1);
            availableRangeRef.current = {
                start: nextAvailableStartDate,
                end: nextAvailableEndDate
            };
            setAvailableRange(availableRangeRef.current);
        } else {
            availableRangeRef.current = null;
            setAvailableRange(null);
        }
    };
    // If the visible range changes, we need to update the available range.
    let [lastVisibleRange, setLastVisibleRange] = (0, $9FN09$react.useState)(calendar.visibleRange);
    if (!(0, $9FN09$internationalizeddate.isEqualDay)(calendar.visibleRange.start, lastVisibleRange.start) || !(0, $9FN09$internationalizeddate.isEqualDay)(calendar.visibleRange.end, lastVisibleRange.end)) {
        updateAvailableRange(anchorDate);
        setLastVisibleRange(calendar.visibleRange);
    }
    let setAnchorDate = (date)=>{
        if (date) {
            setAnchorDateState(date);
            updateAvailableRange(date);
        } else {
            setAnchorDateState(null);
            updateAvailableRange(null);
        }
    };
    let highlightedRange = anchorDate ? $9e947abe92c47a22$var$makeRange(anchorDate, calendar.focusedDate) : value && $9e947abe92c47a22$var$makeRange(value.start, value.end);
    let selectDate = (date)=>{
        if (props.isReadOnly) return;
        const constrainedDate = (0, $8b8d004404afcaba$exports.constrainValue)(date, min, max);
        const previousAvailableConstrainedDate = (0, $8b8d004404afcaba$exports.previousAvailableDate)(constrainedDate, calendar.visibleRange.start, props.isDateUnavailable);
        if (!previousAvailableConstrainedDate) return;
        if (!anchorDate) setAnchorDate(previousAvailableConstrainedDate);
        else {
            let range = $9e947abe92c47a22$var$makeRange(anchorDate, previousAvailableConstrainedDate);
            if (range) setValue({
                start: $9e947abe92c47a22$var$convertValue(range.start, value?.start),
                end: $9e947abe92c47a22$var$convertValue(range.end, value?.end)
            });
            setAnchorDate(null);
        }
    };
    let [isDragging, setDragging] = (0, $9FN09$react.useState)(false);
    let { isDateUnavailable: isDateUnavailable } = props;
    let isInvalidSelection = (0, $9FN09$react.useMemo)(()=>{
        if (!value || anchorDate) return false;
        if (isDateUnavailable && (isDateUnavailable(value.start) || isDateUnavailable(value.end))) return true;
        return (0, $8b8d004404afcaba$exports.isInvalid)(value.start, minValue, maxValue) || (0, $8b8d004404afcaba$exports.isInvalid)(value.end, minValue, maxValue);
    }, [
        isDateUnavailable,
        value,
        anchorDate,
        minValue,
        maxValue
    ]);
    let isValueInvalid = props.isInvalid || props.validationState === 'invalid' || isInvalidSelection;
    let validationState = isValueInvalid ? 'invalid' : null;
    return {
        ...calendar,
        value: value,
        setValue: setValue,
        anchorDate: anchorDate,
        setAnchorDate: setAnchorDate,
        highlightedRange: highlightedRange,
        validationState: validationState,
        isValueInvalid: isValueInvalid,
        selectFocusedDate () {
            selectDate(calendar.focusedDate);
        },
        selectDate: selectDate,
        highlightDate (date) {
            if (anchorDate) calendar.setFocusedDate(date);
        },
        isSelected (date) {
            return Boolean(highlightedRange && date.compare(highlightedRange.start) >= 0 && date.compare(highlightedRange.end) <= 0 && !calendar.isCellDisabled(date) && !calendar.isCellUnavailable(date));
        },
        isInvalid (date) {
            return calendar.isInvalid(date) || (0, $8b8d004404afcaba$exports.isInvalid)(date, availableRangeRef.current?.start, availableRangeRef.current?.end);
        },
        isDragging: isDragging,
        setDragging: setDragging,
        clearSelection () {
            setAnchorDate(null);
            setValue(null);
        }
    };
}
function $9e947abe92c47a22$var$makeRange(start, end) {
    if (!start || !end) return null;
    if (end.compare(start) < 0) [start, end] = [
        end,
        start
    ];
    return {
        start: (0, $9FN09$internationalizeddate.toCalendarDate)(start),
        end: (0, $9FN09$internationalizeddate.toCalendarDate)(end)
    };
}
function $9e947abe92c47a22$var$convertValue(newValue, oldValue) {
    // The display calendar should not have any effect on the emitted value.
    // Emit dates in the same calendar as the original value, if any, otherwise gregorian.
    newValue = (0, $9FN09$internationalizeddate.toCalendar)(newValue, oldValue?.calendar || new (0, $9FN09$internationalizeddate.GregorianCalendar)());
    // Preserve time if the input value had one.
    if (oldValue && 'hour' in oldValue) return oldValue.set(newValue);
    return newValue;
}
function $9e947abe92c47a22$var$nextUnavailableDate(anchorDate, state, dir) {
    let nextDate = anchorDate.add({
        days: dir
    });
    while((dir < 0 ? nextDate.compare(state.visibleRange.start) >= 0 : nextDate.compare(state.visibleRange.end) <= 0) && !state.isCellUnavailable(nextDate))nextDate = nextDate.add({
        days: dir
    });
    if (state.isCellUnavailable(nextDate)) return nextDate.add({
        days: -dir
    });
}


//# sourceMappingURL=useRangeCalendarState.cjs.map
