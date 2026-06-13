import { useSettings } from '../hooks/useSettings'
import Hero from '../components/guest/Hero'
import Gallery from '../components/guest/Gallery'
import Description from '../components/guest/Description'
import Pricing from '../components/guest/Pricing'
import AvailabilityCalendar from '../components/guest/AvailabilityCalendar'
import InquiryForm from '../components/guest/InquiryForm'
import ContactSection from '../components/guest/ContactSection'
import Footer from '../components/guest/Footer'
import PromoPopup from '../components/guest/PromoPopup'

export default function GuestLanding({ forcePopup = false }) {
  const { settings } = useSettings()
  return (
    <>
      <PromoPopup settings={settings} forceOpen={forcePopup} />
      <Hero settings={settings} />
      <Gallery />
      <Description settings={settings} />
      <Pricing settings={settings} />
      <AvailabilityCalendar />
      <InquiryForm />
      <ContactSection settings={settings} />
      <Footer settings={settings} />
    </>
  )
}
