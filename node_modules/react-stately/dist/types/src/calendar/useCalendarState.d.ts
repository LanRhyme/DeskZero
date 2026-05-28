import { Calendar, CalendarIdentifier, DateDuration } from '@internationalized/date';
import { CalendarPropsBase, CalendarState, DateValue, MappedDateValue } from './types';
import { ValueBase } from '@react-types/shared';
export interface CalendarProps<T extends DateValue> extends CalendarPropsBase, ValueBase<T | null, MappedDateValue<T>> {
}
export interface CalendarStateOptions<T extends DateValue = DateValue> extends CalendarProps<T> {
    /** The locale to display and edit the value according to. */
    locale: string;
    /**
     * A function that creates a [Calendar](../internationalized/date/Calendar.html)
     * object for a given calendar identifier. Such a function may be imported from the
     * `@internationalized/date` package, or manually implemented to include support for
     * only certain calendars.
     */
    createCalendar: (name: CalendarIdentifier) => Calendar;
    /**
     * The amount of days that will be displayed at once. This affects how pagination works.
     * @default {months: 1}
     */
    visibleDuration?: DateDuration;
    /**
     * Determines the alignment of the visible months on initial render based on the current selection or current date if there is no selection.
     * @default 'center'
     */
    selectionAlignment?: 'start' | 'center' | 'end';
}
/**
 * Provides state management for a calendar component.
 * A calendar displays one or more date grids and allows users to select a single date.
 */
export declare function useCalendarState<T extends DateValue = DateValue>(props: CalendarStateOptions<T>): CalendarState;
