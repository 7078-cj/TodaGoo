export default function SearchInput({ searchQuery, setSearchQuery, action = null }) {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border shadow-lg rounded-xl px-3 py-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a place..."
                    className="flex-1 outline-none text-sm bg-transparent"
                />
                <button
                    onClick={action}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                    Search
                </button>
            </div>
        </div>
    );
}