// Join codes are stored as 6 characters ("K7Q2MX") and shown with a dash in
// the middle ("K7Q-2MX"), which is easier to read out in class.
// Turns whatever is typed ("k7q2mx", "K7Q 2MX") into the display form "K7Q-2MX".
export const tidyJoinCodeInput = (input: string) => {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw
}

export const formatJoinCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code)
