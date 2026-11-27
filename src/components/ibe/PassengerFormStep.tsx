import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SINDBAD_SAVED_TRAVELERS } from "../../data/ancillariesAndSeats";
import { useIBE } from "../../context/IBEContext";
import {
  validateIcaoPassenger,
  validatePassengerAgeForType,
  type PassengerRole,
} from "../../lib/ibe-rules";
import { Button } from "../ui/button";

export interface PassengerFormData {
  role: PassengerRole;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  passport: string;
  passportExpiry?: string | undefined;
  issuingCountry?: string | undefined;
  nationality: string;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  sindbadNo: string;
}

interface PassengerFormStepProps {
  passengers: PassengerFormData[];
  travelDateISO: string;
  onChange: (index: number, patch: Partial<PassengerFormData>) => void;
}

export function PassengerFormStep({ passengers, travelDateISO, onChange }: PassengerFormStepProps) {
  const { sindbadSignedIn, lang } = useIBE();

  const handleSimulatePassportScan = (idx: number) => {
    const preset = SINDBAD_SAVED_TRAVELERS[idx % SINDBAD_SAVED_TRAVELERS.length]!;
    onChange(idx, {
      firstName: preset.firstName,
      lastName: preset.lastName,
      dob: preset.dob,
      gender: preset.gender,
      passport: preset.passport,
      nationality: preset.nationality,
      sindbadNo: preset.sindbadNo,
    });
    toast.success("Demo OCR auto-fill populated sample MRZ fields.");
  };

  const applySavedTraveler = (idx: number, trvId: string) => {
    const t = SINDBAD_SAVED_TRAVELERS.find((x) => x.id === trvId);
    if (!t) return;
    onChange(idx, {
      firstName: t.firstName,
      lastName: t.lastName,
      dob: t.dob,
      gender: t.gender,
      passport: t.passport,
      nationality: t.nationality,
      sindbadNo: t.sindbadNo,
    });
    toast.success(`Populated ${t.firstName} ${t.lastName} from Saved Travelers.`);
  };

  return (
    <div className="space-y-5">
      {passengers.map((p, idx) => {
        const icaoCheck = validateIcaoPassenger({
          firstName: p.firstName,
          lastName: p.lastName,
          passport: p.passport,
        });
        const ageCheck = validatePassengerAgeForType(p.dob, p.role, travelDateISO);
        const valid = icaoCheck.valid && ageCheck.valid;
        const firstError = icaoCheck.errors[0] ?? ageCheck.error;

        return (
          <div key={idx} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                    <span>{lang === "ar" ? `المسافر ${idx + 1}` : `Passenger ${idx + 1}`}</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                      {p.role}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ar"
                      ? "التحقق من تنسيق ICAO والعمر حسب الفئة"
                      : "ICAO name/passport format & passenger-type age validation"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sindbadSignedIn ? (
                  <select
                    aria-label={`Select saved traveler for passenger ${idx + 1}`}
                    defaultValue=""
                    onChange={(e) => applySavedTraveler(idx, e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold"
                  >
                    <option value="" disabled>
                      Saved Travelers...
                    </option>
                    {SINDBAD_SAVED_TRAVELERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.sindbadNo})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Guest checkout (sign in to use Saved Travelers)
                  </span>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-semibold"
                  onClick={() => handleSimulatePassportScan(idx)}
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  Demo Scan Fill
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor={`pax-${idx}-first`} className="mb-1 block text-xs font-semibold">
                  First & Middle Name (Passport)
                </label>
                <input
                  id={`pax-${idx}-first`}
                  value={p.firstName}
                  onChange={(e) => onChange(idx, { firstName: e.target.value.toUpperCase() })}
                  placeholder="TARIQ"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-last`} className="mb-1 block text-xs font-semibold">
                  Last Name (Passport)
                </label>
                <input
                  id={`pax-${idx}-last`}
                  value={p.lastName}
                  onChange={(e) => onChange(idx, { lastName: e.target.value.toUpperCase() })}
                  placeholder="ALBALUSHI"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-passport`} className="mb-1 block text-xs font-semibold">
                  Passport / National ID (APIS)
                </label>
                <input
                  id={`pax-${idx}-passport`}
                  value={p.passport}
                  onChange={(e) => onChange(idx, { passport: e.target.value.toUpperCase() })}
                  placeholder="OM4928174"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-dob`} className="mb-1 block text-xs font-semibold">
                  Date of Birth
                </label>
                <input
                  id={`pax-${idx}-dob`}
                  type="date"
                  value={p.dob}
                  onChange={(e) => onChange(idx, { dob: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-gender`} className="mb-1 block text-xs font-semibold">
                  Gender
                </label>
                <select
                  id={`pax-${idx}-gender`}
                  value={p.gender}
                  onChange={(e) => onChange(idx, { gender: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor={`pax-${idx}-nationality`}
                  className="mb-1 block text-xs font-semibold"
                >
                  Nationality (APIS)
                </label>
                <input
                  id={`pax-${idx}-nationality`}
                  value={p.nationality}
                  onChange={(e) => onChange(idx, { nationality: e.target.value })}
                  placeholder="Oman"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-expiry`} className="mb-1 block text-xs font-semibold">
                  Passport Expiry Date
                </label>
                <input
                  id={`pax-${idx}-expiry`}
                  type="date"
                  value={p.passportExpiry ?? "2030-05-14"}
                  onChange={(e) => onChange(idx, { passportExpiry: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`pax-${idx}-sindbad`} className="mb-1 block text-xs font-semibold">
                  Sindbad FFP Number (Optional)
                </label>
                <input
                  id={`pax-${idx}-sindbad`}
                  value={p.sindbadNo}
                  onChange={(e) => onChange(idx, { sindbadNo: e.target.value.toUpperCase() })}
                  placeholder="SB-8841209"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            {idx === 0 && (
              <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor={`pax-${idx}-email`} className="mb-1 block text-xs font-semibold">
                    Contact Email
                  </label>
                  <input
                    id={`pax-${idx}-email`}
                    type="email"
                    value={p.email}
                    onChange={(e) => onChange(idx, { email: e.target.value })}
                    placeholder="guest@example.com"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`pax-${idx}-phone`} className="mb-1 block text-xs font-semibold">
                    Mobile Phone
                  </label>
                  <input
                    id={`pax-${idx}-phone`}
                    value={p.phone}
                    onChange={(e) => onChange(idx, { phone: e.target.value })}
                    placeholder="+968 9123 4567"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`pax-${idx}-emg-name`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Emergency Contact Name
                  </label>
                  <input
                    id={`pax-${idx}-emg-name`}
                    value={p.emergencyName}
                    onChange={(e) => onChange(idx, { emergencyName: e.target.value })}
                    placeholder="Emergency Contact"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`pax-${idx}-emg-phone`}
                    className="mb-1 block text-xs font-semibold"
                  >
                    Emergency Phone
                  </label>
                  <input
                    id={`pax-${idx}-emg-phone`}
                    value={p.emergencyPhone}
                    onChange={(e) => onChange(idx, { emergencyPhone: e.target.value })}
                    placeholder="+968 9988 1122"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs">
              {valid ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ICAO & age checks passed
                </span>
              ) : (
                <span className="font-medium text-destructive">{firstError}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
