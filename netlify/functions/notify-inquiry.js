export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { first_name, last_name, email, checkin, checkout, adults, children, pets } = body

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_FROM_NUMBER
    const ownerPhones = (process.env.OWNER_PHONES || '').split(',').map(p => p.trim()).filter(Boolean)

    if (!accountSid || !authToken || !fromNumber || !ownerPhones.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Twilio not configured' }), { status: 200 })
    }

    const guestLine = `${first_name} ${last_name}`
    const datesLine = checkin && checkout ? `${checkin} → ${checkout}` : 'Dates TBD'
    const guestsLine = [
      adults ? `${adults} adult${adults > 1 ? 's' : ''}` : null,
      children ? `${children} child${children > 1 ? 'ren' : ''}` : null,
      pets ? `${pets} pet${pets > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(', ')

    const message = `New inquiry — Hollow Valley Crates\n${guestLine}\n${datesLine}\n${guestsLine}\nEmail: ${email}\nCheck admin to respond.`

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const results = await Promise.all(ownerPhones.map(to =>
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: fromNumber, To: to, Body: message }).toString(),
      }).then(r => r.json())
    ))

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 200 })
  }
}
