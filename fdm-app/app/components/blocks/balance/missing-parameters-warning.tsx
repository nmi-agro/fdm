export function MissingParametersWarning({ message }: { message: string }) {
  const listItems = [
    message.match(/a_n_rt/) ? <li key="a_n_rt">Totaal stikstofgehalte</li> : null,
    message.match(/b_soiltype_agr/) ? <li key="b_soiltype_agr">Agrarisch bodemtype</li> : null,
    message.match(/a_c_of|a_som_loi/) ? (
      <li key="a_c_of_a_som_loi">Organische stofgehalte</li>
    ) : null,
  ].filter((item) => item != null)

  return (
    <div className="text-muted-foreground">
      {listItems.length > 0 ? (
        <>
          <p>Voor dit perceel zijn de benodigde bodemparameters niet bekend:</p>
          <br />
          <ul className="list-inside list-disc">{listItems}</ul>
        </>
      ) : (
        <p>Voor dit perceel zijn enkele benodigde bodemparameters niet bekend.</p>
      )}
    </div>
  )
}
