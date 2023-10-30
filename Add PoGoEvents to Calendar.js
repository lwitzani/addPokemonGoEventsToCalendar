// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: gamepad;
// you need to set the calendarName to whatever your calendar's name is
const calendarName = 'PoGo';

// changing the locale affects how dates are presented
// examples for other possible locales: 'de-DE' 'en-US', 'en-GB', 'hi-IN', 'ja-JP'
const locale = 'en-US';

// change the shown texts here
// both should have the same length so that the dates are properly arranged
const startsText = 'starts: ';
const endsText = 'ends:   ';

// change the numbers here to adapt font sizes
const eventTitleFont = Font.systemFont(14);
const startEndInfoFont = Font.lightMonospacedSystemFont(11);

// here you can configure how the dates are shown
// possible values for weekday: 'narrow', 'short', 'long'
// possible values for all except weekday: 'numeric', '2-digit'
const dateFormatOptions = {
    weekday: 'short',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
};

// do not change the values below
const START_DATE = 0;
const FULL_RANGE = 1;
const CANCEL = 2;

// CREDIT for the event data goes to LeekDuck.com with the support of
// ScrapedDuck (https://github.com/bigfoott/ScrapedDuck/tree/master)
const eventsURL = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json';

await executeScript(); // this starts the actual script

async function executeScript() {
    const calendar = await initializeCalendar();
    if (!calendar) {
        showCalendarNotFoundAlert();
    } else {
        const eventMap = await getEventsGroupedByType();
        const table = createUiTable(eventMap, calendar);
        await QuickLook.present(table);
    }
    Script.complete();
}

async function initializeCalendar() {
    try {
        const calendar = await Calendar.forEventsByTitle(calendarName);
        return calendar;
    } catch (e) {
        return undefined;
    }
}

async function getEventsGroupedByType() {
    const eventMap = new Map();
    const allEvents = await loadJSON(eventsURL);
    for (event of allEvents) {
        if (!eventMap.has(event.eventType)) {
            eventMap.set(event.eventType, []);
        }
        eventMap.get(event.eventType).push(event);
    }
    return eventMap;
}

function createUiTable(eventMap, calendar) {
    const listEntries = [];
    const table = new UITable();
    const mapKeys = Array.from(eventMap.keys());
    mapKeys.sort();
    for (key of mapKeys) {
        let events = eventMap.get(key);
        let row = new UITableRow();
        row.addText(convertDashedKeyForUi(key));
        table.addRow(row);
        listEntries.push(null); // dummy for correct index
        for (event of events) {
            let row = new UITableRow()
            let imageCell = row.addImageAtURL(event.image);
            let titleCell = row.addText(event.name, startsText + formatDate(event.start) +
                '\n' + endsText + formatDate(event.end));
            titleCell.titleFont = eventTitleFont;
            titleCell.subtitleFont = startEndInfoFont;
            imageCell.widthWeight = 30;
            titleCell.widthWeight = 70;
            row.height = 80;
            row.cellSpacing = 10;
            row.dismissOnSelect = false;
            row.onSelect = async (idx) => {
                const pogoEvent = listEntries[idx];
                const isSingleDayEvent = new Date(pogoEvent.start).toDateString() === new Date(pogoEvent.end).toDateString();
                const mode = isSingleDayEvent ? FULL_RANGE : await getEntryCreationModeFromUserInput(pogoEvent);
                createCalendarEvent(pogoEvent, mode, calendar);
            }
            table.addRow(row);
            listEntries.push(event);
        }
    }
    return table;
}

function convertDashedKeyForUi(dashedKey) {
    return dashedKey.replace(/-([a-z])/g, function (k) {
        return ' ' + k[1].toUpperCase();
    }).replace(/^([a-z])/g, function (k) {
        return k.toUpperCase();
    });
}

async function getEntryCreationModeFromUserInput(pogoEvent) {
    const alert = new Alert();
    alert.title = 'Select the calendar entry creation mode for the multi-day event \"' + pogoEvent.name + '\".';
    alert.message = '\nIf you only want a single entry in your calendar on the first day of the event then choose \"Start Date only\".\n\nIf you want calendar entries for each day of the event then choose \"Full Range of Event\".';
    alert.addAction('Start Date only');
    alert.addAction("Full Range of Event");
    alert.addAction('Cancel');
    let mode = await alert.present();
    return mode;
}

async function createCalendarEvent(pogoEvent, mode, calendar) {
    if (mode === CANCEL) {
        return;
    }
    const startDate = new Date(pogoEvent.start);
    const endDate = new Date(pogoEvent.end);
    await deleteDuplicateEventFromCalendar(startDate, endDate, calendar, pogoEvent.name);

    const event = new CalendarEvent();
    event.calendar = calendar;
    event.title = pogoEvent.name;
    event.startDate = startDate;
    if (mode === START_DATE) {
        event.endDate = startDate;
    } else if (mode === FULL_RANGE) {
        event.endDate = endDate;
    }
    event.notes = startsText + formatDate(pogoEvent.start) + '\n' + endsText + formatDate(pogoEvent.end);
    event.save();
    showSuccessAlert(pogoEvent.name);
}

async function deleteDuplicateEventFromCalendar(startDate, endDate, calendar, eventName) {
    const eventsInSameRange = await CalendarEvent.between(startDate, endDate, [calendar]);
    const alreadyExistingEvent = eventsInSameRange.find(event => event.title === eventName);
    if (alreadyExistingEvent) {
        alreadyExistingEvent.remove();
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(locale, dateFormatOptions);
}

async function showCalendarNotFoundAlert() {
    const alert = new Alert();
    alert.title = 'Calendar \"' + calendarName + '\" not found'
    alert.message = '\nPlease adapt the \"calendarName\" variable in the script to an existing calender ' +
        'from your calendar app \n\nor\n\ngo to your calendar app and create a new calendar with the name \"' + calendarName + '\".';
    alert.addAction("Close")
    alert.present();
}

async function showSuccessAlert(eventName) {
    const alert = new Alert();
    alert.title = 'Success'
    alert.message = 'An entry for \"' + eventName + '\" was added to your calendar!';
    alert.addAction("Close")
    alert.present();
}

async function loadJSON(url) {
    let req = new Request(url);
    req.timeoutInterval = 5;
    let image = await req.loadJSON();
    return image;
}