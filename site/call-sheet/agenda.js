// agenda.js — scroll-synced mission briefing data
// Each item: startMin/endMin = minutes from midnight (07:30 = 450)
// status: "set" | "hold" | "wrap"

export const AGENDA = [
  {
    id: "call-01",
    startMin: 450,
    endMin: 510,
    status: "set",
    role: "Unit Lead",
    name: "Ravi Menon",
    location: "Stage B — Bay 2",
    pickup: "06:45 · Gate 3",
    reportTo: "Ops Desk",
    note: "First unit call. Confirm comms check. Max 140 chars displayed."
  },
  {
    id: "call-02",
    startMin: 480,
    endMin: 540,
    status: "set",
    role: "2nd Unit",
    name: "Sofia Alvarez",
    location: "Stage C — Bay 1",
    pickup: "07:15 · Gate 3",
    reportTo: "Ops Desk",
    note: "Inserts + plates. Sync with VFX sup on marker placement."
  },
  {
    id: "call-03",
    startMin: 510,
    endMin: 570,
    status: "hold",
    role: "Stunts",
    name: "Jin-Woo Park",
    location: "Backlot 4",
    pickup: "07:30 · Gate 7",
    reportTo: "Stunt Coord",
    note: "Wire rig rehearsal. Safety brief mandatory. Weather hold possible."
  },
  {
    id: "call-04",
    startMin: 540,
    endMin: 630,
    status: "set",
    role: "VFX Sup",
    name: "Priya Nair",
    location: "Stage A — Vol Wall",
    pickup: "08:00 · Gate 1",
    reportTo: "Director",
    note: "LED wall calibrate. Plate shoot for ep 304. HDR refs needed."
  },
  {
    id: "call-05",
    startMin: 600,
    endMin: 690,
    status: "set",
    role: "Art Dept",
    name: "Marco Silva",
    location: "Workshop 12",
    pickup: "08:30 · Gate 5",
    reportTo: "Prod Designer",
    note: "Hero prop delivery. Dress set B by 11:00. Clearances confirmed."
  },
  {
    id: "call-06",
    startMin: 660,
    endMin: 720,
    status: "set",
    role: "Camera",
    name: "Lena Kowalski",
    location: "Stage B — Bay 2",
    pickup: "09:30 · Gate 3",
    reportTo: "DP",
    note: "A-cam handoff. Lens package verified. ND set for exterior."
  },
  {
    id: "call-07",
    startMin: 720,
    endMin: 780,
    status: "hold",
    role: "Sound",
    name: "Diego Torres",
    location: "Stage C — Bay 1",
    pickup: "10:30 · Gate 3",
    reportTo: "Mixer",
    note: "Boom op swap. RF scan at 11:00. Hold on lav freq clearance."
  },
  {
    id: "call-08",
    startMin: 780,
    endMin: 870,
    status: "set",
    role: "Lighting",
    name: "Aisha Hassan",
    location: "Backlot 4",
    pickup: "11:45 · Gate 7",
    reportTo: "Gaffer",
    note: "Pre-light night exterior. Condors positioned. Generator sync."
  },
  {
    id: "call-09",
    startMin: 840,
    endMin: 930,
    status: "set",
    role: "Wardrobe",
    name: "Elena Volkov",
    location: "Truck 3",
    pickup: "12:30 · Gate 5",
    reportTo: "Cost Designer",
    note: "Hero changes ×3. Continuity photos uploaded. Quick-rig stands ready."
  },
  {
    id: "call-10",
    startMin: 900,
    endMin: 990,
    status: "wrap",
    role: "Unit Lead",
    name: "Ravi Menon",
    location: "Stage B — Bay 2",
    pickup: "14:00 · Gate 3",
    reportTo: "Ops Desk",
    note: "Company move to location. Final safety walk. Wrap by 19:00."
  }
];

// Derived constants
export const FIRST_CALL = Math.min(...AGENDA.map(a => a.startMin));
export const WRAP_MAX = Math.max(...AGENDA.map(a => a.endMin));
export const TOTAL_SPAN = WRAP_MAX - FIRST_CALL;