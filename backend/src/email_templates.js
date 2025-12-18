const layout = (content) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background-color: #000; padding: 20px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">GetEzi</h1>
  </div>
  <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
    ${content}
  </div>
  <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p>© ${new Date().getFullYear()} GetEzi Queue Management System. All rights reserved.</p>
  </div>
</div>
`;

const bookingConfirmation = (name, tokenNumber, officeName, address, time) => layout(`
  <h2 style="color: #d93025;">Booking Confirmed!</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>Your token for <strong>${officeName}</strong> has been booked successfully.</p>
  <div style="background-color: #fff0f0; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
    <h1 style="font-size: 48px; margin: 0; color: #d93025;">#${tokenNumber}</h1>
    <p style="margin: 5px 0 0 0;">Your Token Number</p>
  </div>
  <p><strong>Location:</strong> ${address}</p>
  <p><strong>Time:</strong> ${new Date(time).toLocaleString()}</p>
  <p>We will notify you when it's time to travel to the office.</p>
`);

const travelInstruction = (name, tokenNumber, officeName, address, lat, lng, travelStart, arrival) => layout(`
  <h2 style="color: #1a73e8;">Time to Leave!</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>It is time to start traveling to <strong>${officeName}</strong> for your appointment.</p>
  <div style="background-color: #e8f0fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Token:</strong> #${tokenNumber}</p>
    <p><strong>Est. Travel Time:</strong> ${Math.round((new Date(arrival) - new Date(travelStart)) / 60000)} mins</p>
    <p><strong>Target Arrival:</strong> ${new Date(arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  <p><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" style="display: inline-block; background-color: #1a73e8; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">Get Directions</a></p>
`);

const tokenCompleted = (name, tokenNumber, officeName) => layout(`
  <h2 style="color: #137333;">Service Completed</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>Your service at <strong>${officeName}</strong> (Token #${tokenNumber}) has been completed.</p>
  <p>Thank you for using GetEzi.</p>
`);

const tokenCancelled = (name, tokenNumber, officeName, reason) => layout(`
  <h2 style="color: #d93025;">Token Cancelled</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>Your token #${tokenNumber} at <strong>${officeName}</strong> has been cancelled.</p>
  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
`);

const tokenNoShow = (name, tokenNumber, officeName) => layout(`
  <h2 style="color: #e37400;">Missed Appointment</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>We missed you for token #${tokenNumber} at <strong>${officeName}</strong>. Your token has been marked as a no-show.</p>
  <p>Please book a new token if you still require service.</p>
`);

const welcomeCustomer = (name) => layout(`
  <h2>Welcome to GetEzi!</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>Thank you for creating a customer account. You can now book tokens and manage your appointments with ease.</p>
`);

const welcomeAdmin = (name) => layout(`
  <h2>Welcome to GetEzi Partner!</h2>
  <p>Hello <strong>${name}</strong>,</p>
  <p>Thank you for registering your office. You can now manage your queue and serve customers efficiently.</p>
`);

module.exports = {
    bookingConfirmation,
    travelInstruction,
    tokenCompleted,
    tokenCancelled,
    tokenNoShow,
    welcomeCustomer,
    welcomeAdmin
};
