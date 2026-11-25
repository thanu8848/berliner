const ortsteileNachBezirk: Record<string, string[]> = {
  'Mitte': [
    'Mitte', 'Moabit', 'Hansaviertel',
    'Tiergarten', 'Wedding', 'Gesundbrunnen'
  ],

  'Friedrichshain-Kreuzberg': [
    'Friedrichshain', 'Kreuzberg'
  ],

  'Pankow': [
    'Prenzlauer Berg', 'Weißensee', 'Blankenburg',
    'Heinersdorf', 'Karow', 'Stadtrandsiedlung Malchow',
    'Pankow', 'Blankenfelde', 'Buch',
    'Französisch Buchholz', 'Niederschönhausen',
    'Rosenthal', 'Wilhelmsruh'
  ],

  'Charlottenburg-Wilmersdorf': [
    'Charlottenburg', 'Wilmersdorf', 'Schmargendorf',
    'Grunewald', 'Westend', 'Charlottenburg-Nord',
    'Halensee'
  ],

  'Spandau': [
    'Spandau', 'Haselhorst', 'Siemensstadt',
    'Staaken', 'Gatow', 'Kladow',
    'Hakenfelde', 'Falkenhagener Feld', 'Wilhelmstadt'
  ],

  'Steglitz-Zehlendorf': [
    'Steglitz', 'Lichterfelde', 'Lankwitz',
    'Zehlendorf', 'Dahlem', 'Nikolassee',
    'Wannsee', 'Schlachtensee'
  ],

  'Tempelhof-Schöneberg': [
    'Schöneberg', 'Friedenau', 'Tempelhof',
    'Mariendorf', 'Marienfelde', 'Lichtenrade'
  ],

  'Neukölln': [
    'Neukölln', 'Britz', 'Buckow',
    'Rudow', 'Gropiusstadt'
  ],

  'Treptow-Köpenick': [
    'Alt-Treptow', 'Plänterwald', 'Baumschulenweg',
    'Johannisthal', 'Niederschöneweide',
    'Altglienicke', 'Adlershof', 'Bohnsdorf',
    'Oberschöneweide', 'Köpenick', 'Friedrichshagen',
    'Rahnsdorf', 'Grünau', 'Müggelheim',
    'Schmöckwitz'
  ],

  'Marzahn-Hellersdorf': [
    'Marzahn', 'Biesdorf', 'Kaulsdorf',
    'Mahlsdorf', 'Hellersdorf'
  ],

  'Lichtenberg': [
    'Friedrichsfelde', 'Karlshorst', 'Lichtenberg',
    'Falkenberg', 'Malchow', 'Wartenberg',
    'Neu-Hohenschönhausen', 'Alt-Hohenschönhausen',
    'Fennpfuhl', 'Rummelsburg'
  ],

  'Reinickendorf': [
    'Reinickendorf', 'Tegel', 'Konradshöhe',
    'Heiligensee', 'Frohnau', 'Hermsdorf',
    'Waidmannslust', 'Lübars', 'Wittenau',
    'Märkisches Viertel', 'Borsigwalde'
  ]
}

// Alle Ortsteile alphabetisch sortiert
export const berlinOrtsteile = Object.values(
  ortsteileNachBezirk
)
  .flat()
  .sort((a, b) => a.localeCompare(b, 'de'))

// Bezirk anhand eines Ortsteils ermitteln
export function getDistrictForNeighborhood(
  neighborhood: string
): string {
  const match = Object.entries(ortsteileNachBezirk)
    .find(([, ortsteile]) =>
      ortsteile.includes(neighborhood)
    )

  return match?.[0] ?? ''
}
