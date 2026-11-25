import { Camera, CheckCircle2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { SINDBAD_SAVED_TRAVELERS } from "../../data/ancillariesAndSeats";
import { validateIcaoPassenger } from "../../lib/ibe-rules";
import { Button } from "../ui/button";

export interface PassengerFormData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  passport: string;
  nationality: string;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  sindbadNo: string;
}

interface PassengerFormStepProps {
  passengers: PassengerFormData[];
  onChange: (index: number, patch: Partial<PassengerFormData>) => void;
}

/**
 * FR-14 (Scan-to-Form OCR), FR-69 (ICAO Validation), FR-70 (APIS),
 * FR-76 (Emergency Contact), FR-77/78 (Sindbad & Saved Travelers pre-population).
 */
export function PassengerFormStep({ passengers, onChange }: PassengerFormStepProps) {
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
    toast.success("Passport MRZ & APIS fields extracted via Scan-to-Form OCR.");
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
        const check = validateIcaoPassenger({ firstName: p.firstName, lastName: p.lastName, passport: p.passport });
        return (
          <div key={idx} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="font-display text-base font-bold">Passenger {idx + 1} · ICAO & APIS Details</h3>
                  <p className="text-xs text-muted-foreground">Validated against ICAO passport standards before PSS commit</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-semibold"
                  onClick={() => handleSimulatePassportScan(idx)}
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  Scan Passport (OCR)
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">First & Middle Name (Passport)</label>
                <input
                  value={p.firstName}
                  onChange={(e) => onChange(idx, { firstName: e.target.value.toUpperCase() })}
                  placeholder="TARIQ"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Last Name (Passport)</label>
                <input
                  value={p.lastName}
                  onChange={(e) => onChange(idx, { lastName: e.target.value.toUpperCase() })}
                  placeholder="ALBALUSHI"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Passport / National ID (APIS)</label>
                <input
                  value={p.passport}
                  onChange={(e) => onChange(idx, { passport: e.target.value.toUpperCase() })}
                  placeholder="OM4928174"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Date of Birth</label>
                <input
                  type="date"
                  value={p.dob}
                  onChange={(e) => onChange(idx, { dob: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Gender</label>
                <select
                  value={p.gender}
                  onChange={(e) => onChange(idx, { gender: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Sindbad FFP Number (Optional)</label>
                <input
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
                  <label className="mb-1 block text-xs font-semibold">Contact Email</label>
                  <input
                    type="email"
                    value={p.email}
                    onChange={(e) => onChange(idx, { email: e.target.value })}
                    placeholder="tariq@oman.om"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Mobile Phone</label>
                  <input
                    value={p.phone}
                    onChange={(e) => onChange(idx, { phone: e.target.value })}
                    placeholder="+968 9123 4567"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Emergency Contact Name</label>
                  <input
                    value={p.emergencyName}
                    onChange={(e) => onChange(idx, { emergencyName: e.target.value })}
                    placeholder="Salim Al-Balushi"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Emergency Phone</label>
                  <input
                    value={p.emergencyPhone}
                    onChange={(e) => onChange(idx, { emergencyPhone: e.target.value })}
                    placeholder="+968 9988 1122"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs">
              {check.valid ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ICAO & APIS validation passed
                </span>
              ) : (
                <span className="font-medium text-destructive">{check.errors[0]}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}