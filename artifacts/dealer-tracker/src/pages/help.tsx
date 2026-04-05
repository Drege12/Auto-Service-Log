import { Layout } from "@/components/layout";

interface BadgeRowProps {
  label: string;
  color: string;
  description: string;
}

function BadgeRow({ label, color, description }: BadgeRowProps) {
  return (
    <div className="flex items-start gap-4 py-5 border-b-2 border-gray-200 last:border-0">
      <span className={`shrink-0 font-black px-3 py-1 rounded text-sm uppercase tracking-wide text-white ${color}`}>
        {label}
      </span>
      <p className="text-lg font-sans leading-snug text-black">{description}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Help & Guide</h1>
          <p className="text-lg text-gray-600 font-sans">
            A quick reference for understanding what you see in the app.
          </p>
        </div>

        <div className="border-4 border-black rounded-2xl bg-white px-6 pt-4 pb-2">
          <h2 className="text-2xl font-black uppercase mb-1">Vehicle Status Badges</h2>
          <p className="text-base font-sans text-gray-600 mb-2">
            These colored labels appear on a vehicle's detail page.
          </p>
          <BadgeRow
            label="Ready"
            color="bg-green-600"
            description="No faults that impair drivability."
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
      </div>
    </Layout>
  );
}
