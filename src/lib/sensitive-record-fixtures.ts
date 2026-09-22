import { encryptNarrative } from "@/lib/narrative-crypto";
import type { EncryptedCaseNote } from "@/lib/sensitive-records";

// Public key used ONLY for the synthetic demo fixtures; never for live narratives.
export const DEMO_KEY = "synthetic-demo-fixtures-not-for-real-records";
const note1Plain = "Multi-agency child protection referral received from Child and Family Services. Case conference convened with designated officer. Strict monitoring of attendance patterns and guardian pickup authorizations required.";
const note1Enc = encryptNarrative(note1Plain, DEMO_KEY);

const note2Plain = "Student has moderate persistent asthma and severe peanut allergy. Prescribed Salbutamol inhaler and twin EpiPen pack. Inhaler kept on student; backup kit stored in Nurse Station Emergency Cabinet #2.";
const note2Enc = encryptNarrative(note2Plain, DEMO_KEY);

const note3Plain = "IEP formulated for ADHD and auditory processing disorder. Accommodations: 25% extra test time, low-distraction seating, written visual summaries for multi-step task directives.";
const note3Enc = encryptNarrative(note3Plain, DEMO_KEY);

const note4Plain = "Restorative behavioral conference held following classroom verbal altercation. Agreed behavioral improvement contract with peer mediator. Progress review scheduled in 30 days.";
const note4Enc = encryptNarrative(note4Plain, DEMO_KEY);

export const INITIAL_ENCRYPTED_NOTES: EncryptedCaseNote[] = [
  {
    id: "note-001",
    caseId: "sc-case-001",
    authorId: "usr-safe-01",
    authorName: "Rachel Vance",
    noteType: "statutory_case_conference",
    confidentialityTier: "strictly_confidential",
    encryptedCiphertext: note1Enc.ciphertext,
    ivHex: note1Enc.ivHex,
    authTagHex: note1Enc.authTagHex,
    isQuarantined: false,
    createdAt: "2026-09-02T10:15:00Z",
  },
  {
    id: "note-002",
    caseId: "sc-case-002",
    authorId: "usr-nurse-01",
    authorName: "Helena Thorne",
    noteType: "clinical_health_plan",
    confidentialityTier: "confidential",
    encryptedCiphertext: note2Enc.ciphertext,
    ivHex: note2Enc.ivHex,
    authTagHex: note2Enc.authTagHex,
    isQuarantined: false,
    createdAt: "2026-08-28T11:30:00Z",
  },
  {
    id: "note-003",
    caseId: "sc-case-003",
    authorId: "usr-senco-01",
    authorName: "Dr. Arthur Bell",
    noteType: "iep_psychological_evaluation",
    confidentialityTier: "confidential",
    encryptedCiphertext: note3Enc.ciphertext,
    ivHex: note3Enc.ivHex,
    authTagHex: note3Enc.authTagHex,
    isQuarantined: false,
    createdAt: "2026-09-05T09:00:00Z",
  },
  {
    id: "note-004",
    caseId: "sc-case-004",
    authorId: "usr-safe-01",
    authorName: "Rachel Vance",
    noteType: "pastoral_disciplinary_meeting",
    confidentialityTier: "standard_sensitive",
    encryptedCiphertext: note4Enc.ciphertext,
    ivHex: note4Enc.ivHex,
    authTagHex: note4Enc.authTagHex,
    isQuarantined: false,
    createdAt: "2026-09-12T13:30:00Z",
  },
];

