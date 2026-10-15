import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/marketing/legal";
import { pageMetadata, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata("terms");

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of service"
      updated={SITE.updated}
      intro={
        <p>
          These terms cover the hosted version of opentopost. The source code has its own licence in the GitHub repository.
          By using the hosted version, you agree to these terms.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              opentopost finds post ideas in the content you connect and drafts posts for you to review. The hosted version
              has a free plan and paid plans. Each plan has the limits shown on the pricing page and in your workspace
              settings.
            </p>
          ),
        },
        {
          id: "payments",
          title: "Paid plans",
          body: (
            <p>
              Paid plans renew each month or each year until you cancel. Kinde and Stripe take the payment, and we never see
              your card number. You can cancel at any time in Settings, and your plan stays active until the end of the
              period you paid for. On the Team plan, three members are included, and each member after that is added to
              your next bill. Included AI use resets each month. When you use it up, you can add your own model key.
            </p>
          ),
        },
        {
          id: "keys",
          title: "Your model key",
          body: (
            <p>
              On the Free plan, you bring your own model provider key. You pay that provider for your usage, and you follow
              that provider&apos;s terms. On paid plans, we provide the models, and you can still use your own key. You can
              remove your key at any time.
            </p>
          ),
        },
        {
          id: "content",
          title: "Your content",
          body: (
            <>
              <p>
                You own the content you add and the drafts opentopost writes for you. You give us permission to store and
                process that content only to run the service for you.
              </p>
              <p>
                Only connect content you have the right to share. Review every draft before you post it. You are responsible
                for what you publish.
              </p>
            </>
          ),
        },
        {
          id: "use",
          title: "Acceptable use",
          body: (
            <ul>
              <li>Do not use opentopost to send spam or to mislead people.</li>
              <li>Follow LinkedIn&apos;s user agreement when you post.</li>
              <li>Do not try to access other workspaces or to break or overload the service.</li>
            </ul>
          ),
        },
        {
          id: "availability",
          title: "Availability and changes",
          body: (
            <p>
              We work to keep the hosted version available, but we provide it as is, with no guarantee of uptime. We can
              change or stop the hosted version. If we stop it, we will give notice so you can export your data.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Liability",
          body: (
            <p>
              To the extent the law allows, we are not liable for indirect losses, lost profits, or lost data that come from
              using the hosted version.
            </p>
          ),
        },
        {
          id: "ending",
          title: "Ending your use",
          body: (
            <p>
              You can delete your account in settings at any time. We can suspend accounts that break these terms.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <p>
              Questions about these terms: <Contact email={SITE.contactEmail} repo={SITE.repo} />.
            </p>
          ),
        },
      ]}
    />
  );
}
