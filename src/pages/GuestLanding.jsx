import { useState } from 'react'
import { useSettings } from '../hooks/useSettings'
import Hero from '../components/guest/Hero'
import Gallery from '../components/guest/Gallery'
import Description from '../components/guest/Description'
import AvailabilityCalendar from '../components/guest/AvailabilityCalendar'
import InquiryForm from '../components/guest/InquiryForm'
import ContactSection from '../components/guest/ContactSection'
import Footer from '../components/guest/Footer'
import PromoPopup from '../components/guest/PromoPopup'

export default function GuestLanding({ forcePopup = false }) {
  const { settings } = useSettings()
  const [checkin, setCheckin] = useState(null)
  const [checkout, setCheckout] = useState(null)

  function handleDatesSelected(ci, co) {
    setCheckin(ci)
    setCheckout(co)
  }

  return (
    <>
      <PromoPopup settings={settings} forceOpen={forcePopup} />
      <Hero settings={settings} />
      <Gallery />
      <AvailabilityCalendar
        onDatesSelected={handleDatesSelected}
        selectedCheckin={checkin}
        selectedCheckout={checkout}
      />
      <InquiryForm checkin={checkin} checkout={checkout} />
      <Description settings={settings} />
      <ContactSection settings={settings} />
      <Footer settings={settings} />
    </>
  )
}
