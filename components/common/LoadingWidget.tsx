const Widget = ({ message }) => {
	return (
		<div className="relative flex justify-center items-center h-screen">
			<div className="inline-block motion-safe:animate-spin ease duration-300 w-5 h-5 mx-2">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>Î
				</div>
			<div className="inline-block h-5 mx-2">{message}</div>
		</div>
	)
}

export default Widget