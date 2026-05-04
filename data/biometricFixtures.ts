export type BiometricFixtureDefinition = {
  fileName: string;
  index: number | null;
  isStandard: boolean;
  kind: "face" | "fingerprint";
  label: string;
  slug: string;
};

export const BIOMETRIC_FIXTURE_DEFINITIONS: BiometricFixtureDefinition[] = [
  { slug: "polegar-direito", label: "Polegar direito", kind: "fingerprint", index: 0, isStandard: true, fileName: "polegar direto.png" },
  { slug: "indicador-direito", label: "Indicador direito", kind: "fingerprint", index: 1, isStandard: true, fileName: "indicador direito .png" },
  { slug: "medio-direito", label: "Médio direito", kind: "fingerprint", index: 2, isStandard: true, fileName: "medio direito.png" },
  { slug: "anelar-direito", label: "Anelar direito", kind: "fingerprint", index: 3, isStandard: true, fileName: "Anelar direito.png" },
  { slug: "minimo-direito", label: "Mínimo direito", kind: "fingerprint", index: 4, isStandard: true, fileName: "Mínimo direito.png" },
  { slug: "polegar-esquerdo", label: "Polegar esquerdo", kind: "fingerprint", index: 5, isStandard: true, fileName: "Polegar esquerdo.png" },
  { slug: "indicador-esquerdo", label: "Indicador esquerdo", kind: "fingerprint", index: 6, isStandard: true, fileName: "Indicador esquerdo.png" },
  { slug: "medio-esquerdo", label: "Médio esquerdo", kind: "fingerprint", index: 7, isStandard: true, fileName: "Médio esquerdo.png" },
  { slug: "anelar-esquerdo", label: "Anelar esquerdo", kind: "fingerprint", index: 8, isStandard: true, fileName: "Anelar esquerdo .png" },
  { slug: "minimo-esquerdo", label: "Mínimo esquerdo", kind: "fingerprint", index: 9, isStandard: true, fileName: "Mínimo esquerdo .png" },
  { slug: "face", label: "Face", kind: "face", index: 10, isStandard: true, fileName: "face.png" },
  { slug: "digital-teste", label: "Digital teste", kind: "fingerprint", index: null, isStandard: false, fileName: "digital teste.png" },
  { slug: "teste-teste", label: "Teste teste", kind: "fingerprint", index: null, isStandard: false, fileName: "Teste teste.png" },
  { slug: "teste-teste-2", label: "Teste teste 2", kind: "fingerprint", index: null, isStandard: false, fileName: "Teste teste 2.png" },
  { slug: "cccc", label: "CCCC", kind: "fingerprint", index: null, isStandard: false, fileName: "cccc.png" },
  { slug: "teaaaaaaaaaaaaaaaaaa", label: "Teaaaaaaaaaaaaaaaaaa", kind: "fingerprint", index: null, isStandard: false, fileName: "Teaaaaaaaaaaaaaaaaaa.png" },
  { slug: "ffffffffffffffff", label: "ffffffffffffffff", kind: "fingerprint", index: null, isStandard: false, fileName: "ffffffffffffffff.png" },
];
