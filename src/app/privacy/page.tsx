export const dynamic = "force-static";

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <p>
        CloudKitchen Dev ("we", "us") provides an AI-powered marketing poster generator and
        WhatsApp messaging tool for restaurant and cloud kitchen businesses.
      </p>

      <h2>Information We Collect</h2>
      <p>
        When you use this application, we process business lead data you provide (such as
        names, phone numbers, business names, and marketing offers) in order to generate
        marketing posters and send WhatsApp messages on your behalf.
      </p>

      <h2>How We Use Information</h2>
      <ul>
        <li>To generate AI-powered marketing posters for your business leads.</li>
        <li>To send WhatsApp messages containing those posters to the phone numbers you provide.</li>
        <li>To track campaign status and delivery for your own reporting.</li>
      </ul>

      <h2>Data Sharing</h2>
      <p>
        We share data with third-party service providers strictly to operate this
        application, including Google Gemini (AI content generation), Meta WhatsApp
        Business Platform (message delivery), and our hosting/database providers. We do
        not sell your data.
      </p>

      <h2>Data Retention</h2>
      <p>
        Lead and campaign data is retained for as long as needed to provide this service,
        and may be deleted upon request.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about this policy or to request data deletion, contact the account
        owner of this application.
      </p>
    </main>
  );
}
