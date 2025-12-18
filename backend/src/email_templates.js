const layout = (content) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
  .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #000; color: #fff; padding: 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
  .body { padding: 30px 20px; }
  .info-box { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #000; }
  .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
  .value { font-size: 16px; font-weight: 600; color: #000; margin-bottom: 12px; }
  .cta-btn { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 10px; }
  .footer { background: #f4f4f4; color: #888; padding: 20px; text-align: center; font-size: 12px; }
  .highlight { color: #007bff; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>GetEzi</h1>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>This is an automated email from GetEzi.<br>Please do not reply.</p>
    <p>&copy; ${new Date().getFullYear()} GetEzi Queue Management System</p>
  </div>
</div>
</body>
</html>
`;

module.exports = {
    bookingConfirmation: (name, tokenNum, officeName, address, time) => {
        return {
            subject: 'Your Token is Confirmed – GetEzi',
            html: layout(`
        <h2>Hello ${name},</h2>
        <p>Your token has been successfully booked. You don't need to wait in a physical queue.</p>
        
        <div class="info-box">
          <span class="label">Token Number</span>
          <div class="value" style="font-size: 24px;">#${tokenNum}</div>
          
          <span class="label">Office</span>
          <div class="value">${officeName}</div>
          
          <span class="label">Address</span>
          <div class="value">${address || 'Main Branch'}</div>
          
          <span class="label">Service Time</span>
          <div class="value">${time ? new Date(time).toLocaleString() : 'Pending'}</div>
        </div>
        
        <p>We will notify you when it's time to head to the office.</p>
        <a href="#" class="cta-btn">View My Token</a>
      `)
        };
    },

    travelInstruction: (name, tokenNum, officeName, address, lat, lng, travelStart, arrival) => {
        const mapLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '#';
        return {
            subject: 'It’s Time to Head to the Office – GetEzi',
            html: layout(`
        <h2>Time to Move, ${name}!</h2>
        <p>Your turn is coming up. Please start traveling now to reach the office on time.</p>
        
        <div class="info-box">
          <span class="label">Token</span>
          <div class="value">#${tokenNum}</div>
          
          <span class="label">Destinaton</span>
          <div class="value">${officeName}</div>
          <div style="font-size: 14px; color: #666;">${address || ''}</div>
          
          ${travelStart ? `<span class="label" style="margin-top:10px">Start Traveling</span><div class="value">${new Date(travelStart).toLocaleTimeString()}</div>` : ''}
          ${arrival ? `<span class="label">Target Arrival</span><div class="value">${new Date(arrival).toLocaleTimeString()}</div>` : ''}
        </div>
        
        <a href="${mapLink}" class="cta-btn">Open in Google Maps</a>
      `)
        };
    },

    tokenCompleted: (name, tokenNum, officeName) => {
        return {
            subject: 'Service Completed – Thank You for Visiting',
            html: layout(`
        <h2>Service Completed</h2>
        <p>Hi ${name}, thank you for visiting <strong>${officeName}</strong>.</p>
        <p>We hope your visit was smooth and efficient.</p>
        
        <div class="info-box">
          <span class="label">Token</span>
          <div class="value">#${tokenNum}</div>
          <span class="label">Status</span>
          <div class="value" style="color: green;">Completed</div>
        </div>
        
        <p>If you have any feedback, please let us know.</p>
      `)
        };
    },

    tokenCancelled: (name, tokenNum, officeName, reason) => {
        return {
            subject: 'Your Token Has Been Cancelled – GetEzi',
            html: layout(`
        <h2>Token Cancelled</h2>
        <p>Hi ${name}, your token for <strong>${officeName}</strong> has been cancelled.</p>
        
        <div class="info-box">
          <span class="label">Token</span>
          <div class="value">#${tokenNum}</div>
          ${reason ? `<span class="label">Reason</span><div class="value">${reason}</div>` : ''}
        </div>
        
        <p>You may book a new token anytime if you still require service.</p>
      `)
        };
    },

    tokenNoShow: (name, tokenNum, officeName) => {
        return {
            subject: 'Token Marked as No-Show – GetEzi',
            html: layout(`
        <h2>Token Marked as No-Show</h2>
        <p>Hi ${name}, we missed you at <strong>${officeName}</strong>.</p>
        <p>You did not arrive within the allowed time window.</p>
        
        div class="info-box">
          <span class="label">Token</span>
          <div class="value">#${tokenNum}</div>
          <span class="label">Status</span>
          <div class="value" style="color: red;">No-Show</div>
        </div>
        
        <p>Please book a new token if you still require service.</p>
      `)
        };
    },

    welcomeCustomer: (name) => {
        return {
            subject: 'Welcome to GetEzi – Your Time Matters',
            html: layout(`
        <h2>Welcome to GetEzi, ${name}!</h2>
        <p>We are thrilled to have you on board.</p>
        <p>With GetEzi, you can:</p>
        <ul>
          <li>Book tokens remotely & avoid lines</li>
          <li>Get real-time updates on your wait time</li>
          <li>Plan your day with our smart travel alerts</li>
        </ul>
        <p>Always check your dashboard for the latest updates.</p>
        <a href="#" class="cta-btn">Go to Dashboard</a>
      `)
        };
    },

    welcomeAdmin: (name) => {
        return {
            subject: 'Welcome to GetEzi Admin Panel',
            html: layout(`
        <h2>Welcome Admin, ${name}</h2>
        <p>You now have access to the GetEzi Admin Panel.</p>
        <p>Features available to you:</p>
        <ul>
           <li>Manage offices and counters</li>
           <li>Call tokens and manage flow</li>
           <li>Pause/Resume operations</li>
           <li>View analytics</li>
        </ul>
        <p>Thank you for ensuring smooth queue operations.</p>
        <a href="#" class="cta-btn">Access Admin Panel</a>
      `)
        };
    }
};
