// Join codes are stored as 6 characters ("K7Q2MX") and shown with a dash in
// the middle ("K7Q-2MX"), which is easier to read out in class.
export const formatJoinCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code)
