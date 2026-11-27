import { Link } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { Button } from "../ui/button";

interface BookingConfirmationStepProps {
  confirmedRloc: string;
  confirmedMode: "pay" | "hold";
  onBookAnother: () => void;
}

export function BookingConfirmationStep({
  confirmedRloc,
  confirmedMode,
  onBookAnother,
}: BookingConfirmationStepProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border-2 border-success/40 bg-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
        <Ticket className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-3xl font-extrabold">
        {confirmedMode === "hold" ? "Fare Held" : "Booking Confirmed!"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your Oman Air Record Locator (RLOC) is synced across Manage My Booking & Check-in.
      </p>
      <div className="mx-auto mt-5 inline-block rounded-2xl border border-gold bg-gold/15 px-8 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Booking Reference
        </p>
        <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-primary">
          {confirmedRloc}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="rounded-xl font-display font-bold">
          <Link to="/manage">Add Extras or Manage Booking</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="rounded-xl font-display font-bold">
          <Link to="/checkin">Go to Online Check-in</Link>
        </Button>
        <Button variant="outline" size="lg" className="rounded-xl" onClick={onBookAnother}>
          Book Another Flight
        </Button>
      </div>
    </div>
  );
}
