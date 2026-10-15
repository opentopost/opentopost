import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/marketing/legal";
import { pageMetadata, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata("privacy");

const contact = <Contact email={SITE.contactEmail} repo={SITE.repo} />;

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy policy"
      updated={SITE.updated}
      intro={
        <p>
          This policy covers the hosted version of opentopost. If your team runs its own copy, your team controls that
          data, and this policy does not apply to it.
        </p>
      }
      sections={[
        {
          id: "data",
          title: "Data we collect",
          body: (
            <ul>
              <li>Account data: your name, email address, and sign-in ID, received from our sign-in provider.</li>
              <li>Workspace data: the notes, source content, voice samples (text, recordings, images, and links you add, and their transcripts), voice notes, ideas, drafts, and post links you add.</li>
              <li>Model keys and connection tokens, which we encrypt with AES-256-GCM before we store them.</li>
              <li>Basic usage records, such as when a scan ran and how many model tokens it used.</li>
              <li>
                Product analytics: the pages you view, the buttons and links you click, how far you scroll, and how long a page is
                active, with your browser type, device type, language, and time zone. We tie these to a random ID kept in your
                browser, and to your account when you are signed in. We do not record what you type.
              </li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <>
              <p>We use your data only to run opentopost for you: to sign you in, find post ideas, write drafts, and show results.</p>
              <p>We do not sell your data. We do not use it to train models. We do not show ads.</p>
            </>
          ),
        },
        {
          id: "processors",
          title: "Who processes it",
          body: (
            <ul>
              <li>Kinde runs sign-in. When card payments are on, Kinde runs billing and Stripe processes payments for Kinde.</li>
              <li>Convex stores workspace data and runs the server functions.</li>
              <li>Vercel hosts the website.</li>
              <li>
                The model provider you choose (Google, Anthropic, OpenAI, or OpenRouter) receives the content needed for each
                request, under your own API key and that provider&apos;s terms. On paid plans, Anthropic receives it under
                our key, and Google receives voice recordings and videos.
              </li>
            </ul>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: <p>We use only the cookies needed to keep you signed in. We use no advertising or tracking cookies. Our analytics keep a random ID in your browser&apos;s local storage, not in a cookie, and are off when your browser sends Do Not Track or Global Privacy Control.</p>,
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <p>
              We keep your data while your account exists. When you delete a workspace or your account in settings, we
              delete the data in it from our database. You can export a workspace as JSON at any time.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <p>
              You can see, export, correct, and delete your data in the app. For any other request, such as a copy of your
              account data, contact us at {contact}.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>When we change this policy, we update the date at the top of this page.</p>,
        },
      ]}
    />
  );
}
