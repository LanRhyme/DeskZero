import { CalendarDate } from '@internationalized/date';
import { CalendarState } from 'react-stately/useCalendarState';
import { RangeCalendarState } from 'react-stately/useRangeCalendarState';
interface HookData {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    errorMessageId: string;
    selectedDateDescription: string;
}
export declare const hookData: WeakMap<CalendarState | RangeCalendarState, HookData>;
export declare function getEraFormat(date: CalendarDate | undefined): 'short' | undefined;
export declare function useSelectedDateDescription(state: CalendarState | RangeCalendarState): string;
export declare function useVisibleRangeDescription(startDate: CalendarDate, endDate: CalendarDate, timeZone: string, isAria: boolean): string;
export {};
