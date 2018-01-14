export default function id (len = 7) {
  let i = ''
  while (i.length < len) {
    i += Math.random()
      .toString(36)
      .substr(2, len)
  }
  return i.substr(0, len)
}
