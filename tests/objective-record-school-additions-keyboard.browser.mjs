// Same full keyboard input + carries as TEST, but route must use the
// independent school Edge and an approved fictional pupil in a school class.
// All HTTP requests are mocked: NO real school accounts or results are touched.
process.env.MATHAS_SCHOOL_KEYBOARD_CLASS='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
await import('./objective-record-additions-real-keyboard.browser.mjs');
