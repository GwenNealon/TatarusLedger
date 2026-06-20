export function toIconUrl(iconId: number): string {
  const iconName = String(iconId).padStart(6, '0')
  const folder = `${iconName.slice(0, 3)}000`
  return `https://xivapi.com/i/${folder}/${iconName}.png`
}
