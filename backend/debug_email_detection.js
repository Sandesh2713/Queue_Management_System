const emailTemplates = require('./src/email_templates');

const testContent = emailTemplates.bookingConfirmation('John', '123', 'Office A', '123 St', new Date().toISOString());

console.log('--- Content Start ---');
console.log(testContent.substring(0, 50));
console.log('--- Content End ---');

const isString = typeof testContent === 'string';
const trimmed = testContent.trim();
const startsWithBracket = trimmed.startsWith('<');

console.log('Is String:', isString);
console.log('Trimmed Start:', trimmed.substring(0, 10));
console.log('Starts with <:', startsWithBracket); // Should be true

if (isString && startsWithBracket) {
    console.log('Detection: HTML');
} else {
    console.log('Detection: TEXT');
}
