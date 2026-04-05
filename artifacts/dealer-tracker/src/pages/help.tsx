import { useState } from "react";
import { Layout } from "@/components/layout";
import { ChevronDown, ChevronUp } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getRole(): string {
  try {
    return JSON.parse(localStorage.getItem("dt_mechanic") || "{}").role ?? "mechanic";
  } catch { return "mechanic"; }
}

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

function Accordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.id ?? null);
  return (
    <div className="space-y-3">
      {sections.map(s => (
        <div key={s.id} className="border-4 border-black rounded-2xl overflow-hidden bg-white">
          <button
            type="button"
            className="w-full flex items-center justify-between px-6 py-5 text-left font-black uppercase text-xl bg-white hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === s.id ? null : s.id)}
          >
            {s.title}
            {open === s.id
              ? <ChevronUp className="w-6 h-6 flex-shrink-0" />
              : <ChevronDown className="w-6 h-6 flex-shrink-0" />}
          </button>
          {open === s.id && (
            <div className="px-6 pb-6 border-t-4 border-black bg-white">
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface BadgeRowProps {
  label: string;
  color: string;
  description: string;
}

function BadgeRow({ label, color, description }: BadgeRowProps) {
  return (
    <div className="flex items-start gap-4 py-4 border-b-2 border-gray-200 last:border-0">
      <span className={`shrink-0 font-black px-3 py-1 rounded text-sm uppercase tracking-wide text-white ${color}`}>
        {label}
      </span>
      <p className="text-lg font-sans leading-snug text-black">{description}</p>
    </div>
  );
}

const statusSection: Section = {
  id: "status-badges",
  title: "Vehicle Status Badges",
  content: (
    <div className="pt-4 space-y-1">
      <p className="text-base font-sans text-gray-600 mb-4">
        These colored labels appear on a vehicle's detail page and tell you where things stand with that vehicle at a glance.
      </p>
      <BadgeRow
        label="In Service"
        color="bg-blue-600"
        description="A technician is actively working on this vehicle right now."
      />
      <BadgeRow
        label="Ready"
        color="bg-green-600"
        description="Work is complete. The vehicle is ready to go."
      />
      <BadgeRow
        label="On Hold"
        color="bg-amber-500"
        description="Work has been paused. This often means the shop is waiting on parts, an approval, or more information before they can continue."
      />
      <BadgeRow
        label="Service Due"
        color="bg-amber-500"
        description="Routine maintenance is coming up or overdue. No urgent issue, but something needs to be scheduled soon."
      />
      <BadgeRow
        label="Needs Attention"
        color="bg-orange-600"
        description="Something has been flagged that requires attention. Check with your technician for details."
      />
      <BadgeRow
        label="Out of Service"
        color="bg-red-600"
        description="The vehicle is not available for use. It may be unsafe to drive or waiting on a major repair."
      />
    </div>
  ),
};

const techBannerSection: Section = {
  id: "tech-banners",
  title: "Technician Banners",
  content: (
    <div className="pt-4 space-y-4">
      <p className="text-base font-sans text-gray-600">
        When you open a vehicle, you may see one of these banners near the top of the page.
      </p>

      <div className="rounded-xl border-4 border-gray-400 bg-gray-100 px-5 py-4">
        <p className="font-black uppercase text-gray-600 text-lg">No technician assigned yet</p>
        <p className="text-base font-sans text-gray-700 mt-1">
          This vehicle hasn't been assigned to a specific technician. An admin will assign one when the work is ready to begin.
        </p>
      </div>

      <div className="rounded-xl border-4 border-amber-500 bg-amber-50 px-5 py-4">
        <p className="font-black uppercase text-amber-800 text-lg">Your Technician: [Name]</p>
        <p className="text-base font-sans text-amber-900 mt-1">
          A technician has been assigned to this vehicle. That's the person handling the work. You can reach them through the Messages section if you have questions.
        </p>
      </div>
    </div>
  ),
};

const soldSection: Section = {
  id: "sold-badge",
  title: "The Sold Badge",
  content: (
    <div className="pt-4 space-y-4">
      <div className="flex items-start gap-4">
        <span className="shrink-0 font-black px-3 py-1 rounded text-sm uppercase tracking-wide text-white bg-gray-500">
          Sold
        </span>
        <p className="text-lg font-sans leading-snug text-black">
          This vehicle has been marked as sold. It moves to a separate "Sold Vehicles" section at the bottom of the list. Sold vehicles are kept for your records and aren't lost — they're just archived out of the active list.
        </p>
      </div>
    </div>
  ),
};

const notifSection: Section = {
  id: "notifications",
  title: "Notification & Message Counts",
  content: (
    <div className="pt-4 space-y-4">
      <p className="text-base font-sans text-gray-600">
        In the top navigation bar, you'll see two icons that may show a small red number.
      </p>

      <div className="border-2 border-black rounded-xl px-5 py-4 space-y-1">
        <p className="font-black uppercase text-lg">Bell icon — Alerts</p>
        <p className="text-base font-sans text-gray-700">
          Notifications from the shop, such as updates on your vehicle's status or messages from an admin. The red number is how many you haven't read yet.
        </p>
      </div>

      <div className="border-2 border-black rounded-xl px-5 py-4 space-y-1">
        <p className="font-black uppercase text-lg">Chat bubble icon — Messages</p>
        <p className="text-base font-sans text-gray-700">
          Direct messages and group chats. The red number is your unread message count across all conversations.
        </p>
      </div>
    </div>
  ),
};

const accountSection: Section = {
  id: "account-badge",
  title: "Your Account Badge",
  content: (
    <div className="pt-4 space-y-4">
      <p className="text-base font-sans text-gray-600">
        On larger screens you'll see your name in the top-right corner with a small badge next to it.
      </p>

      <div className="flex items-start gap-4">
        <span className="shrink-0 font-black px-3 py-1 rounded text-xs uppercase tracking-widest text-white bg-teal-600">
          Driver
        </span>
        <p className="text-base font-sans text-gray-700">
          This shows your account type. As an operator, you can add and track your own vehicles and communicate with the shop. Technicians and admins have different account types with more access to shop tools.
        </p>
      </div>
    </div>
  ),
};

export default function HelpPage() {
  const role = getRole();

  const sections: Section[] = [
    statusSection,
    techBannerSection,
    soldSection,
    notifSection,
    accountSection,
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Help & Guide</h1>
          <p className="text-lg text-gray-600 font-sans">
            A quick reference for understanding what you see in the app.
          </p>
          {role !== "driver" && (
            <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3 text-amber-800 font-sans text-sm">
              This guide is written for operators. Some items may not apply to your account type.
            </div>
          )}
        </div>

        <Accordion sections={sections} />
      </div>
    </Layout>
  );
}
