export function getFieldNavigationItems(
  b_id_farm: string,
  calendar: string,
  b_id: string,
  hasDeletePermission: boolean = false,
) {
  const items = [
    {
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/overview`,
      title: "Gegevens",
      segment: "overview",
    },
    {
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation`,
      title: "Gewassen",
      segment: "cultivation",
    },
    {
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/fertilizer`,
      title: "Bemesting",
      segment: "fertilizer",
    },
    {
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/soil`,
      title: "Bodem",
      segment: "soil",
    },
    {
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/bcs`,
      title: "BodemConditieScore",
      segment: "bcs",
    },
  ]

  if (hasDeletePermission) {
    items.push({
      to: `/farm/${b_id_farm}/${calendar}/field/${b_id}/delete`,
      title: "Verwijderen",
      segment: "delete",
    })
  }

  return items
}
