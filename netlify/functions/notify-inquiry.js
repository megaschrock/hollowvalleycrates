export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { first_name, last_name, email, checkin, checkout, adults, children, pets } = body

    const token = process.env.PUSHOVER_TOKEN
    const user = process.env.PUSHOVER_USER_KEY

    if (!token || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Pushover not configured' }), { status: 200 })
    }

    const datesLine = checkin && checkout ? `${checkin} → ${checkout}` : 'Dates TBD'
    const guestsLine = [
      adults ? `${adults} adult${adults > 1 ? 's' : ''}` : null,
      children ? `${children} child${children > 1 ? 'ren' : ''}` : null,
      pets ? `${pets} pet${pets > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(', ')

    const message = `${first_name} ${last_name}\n${datesLine}\n${guestsLine}\nEmail: ${email}`

    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        user,
        title: 'New Inquiry — Hollow Valley Crates',
        message,
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify({ ok: result.status === 1, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 200 })
  }
}
