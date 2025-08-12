"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  owner_id: string;
  owner_name?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  rank: number;
  snippet?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const resultsPerPage = 10;

  const performSearch = async (searchQuery: string, page: number = 1) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotal(0);
      setSearchPerformed(false);
      return;
    }

    setIsLoading(true);
    try {
      const offset = (page - 1) * resultsPerPage;
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(
          searchQuery
        )}&limit=${resultsPerPage}&offset=${offset}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.documents || []);
        setTotal(data.total || 0);
        setCurrentPage(page);
        setSearchPerformed(true);
      } else {
        console.error("Search failed:", response.statusText);
        setResults([]);
        setTotal(0);
      }
    } catch (error) {
      console.error("Error performing search:", error);
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, 1);
  };

  const handlePageChange = (page: number) => {
    performSearch(query, page);
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  const formatSnippet = (snippet: string) => {
    return snippet
      .replace(/<b>/g, '<mark class="bg-yellow-200">')
      .replace(/<\/b>/g, "</mark>");
  };

  const getDocumentIcon = () => {
    return (
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Search Documents
          </h1>
          <p className="text-gray-600">
            Search through your documents and shared content with full-text
            search.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents, titles, descriptions, or tags..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-black"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {/* Search Results */}
        {searchPerformed && (
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                {isLoading
                  ? "Searching..."
                  : `Found ${total} result${total === 1 ? "" : "s"}`}
              </p>
              {total > 0 && (
                <p className="text-sm text-gray-500">
                  Page {currentPage} of {Math.ceil(total / resultsPerPage)}
                </p>
              )}
            </div>

            {/* Results List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Searching documents...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No results found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or browse your documents.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/documents/${result.id}`)}
                  >
                    <div className="flex items-start space-x-4">
                      {getDocumentIcon()}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3
                            className="text-lg font-medium text-gray-900 truncate"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(result.title, query),
                            }}
                          />
                          <div className="flex items-center space-x-2">
                            {result.is_public && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Public
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              Rank: {result.rank.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        {result.description && (
                          <p
                            className="text-sm text-gray-600 mb-2"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(result.description, query),
                            }}
                          />
                        )}

                        {/* Search Snippet */}
                        {result.snippet && (
                          <div className="mb-3 p-3 bg-gray-50 rounded-md">
                            <p
                              className="text-sm text-gray-700 leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: formatSnippet(result.snippet),
                              }}
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Owner: {result.owner_name || "Unknown"}</span>
                            <span>
                              Updated: {formatDate(result.updated_at)}
                            </span>
                            {result.tags && result.tags.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <span>Tags:</span>
                                {result.tags.slice(0, 3).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {result.tags.length > 3 && (
                                  <span className="text-xs text-gray-400">
                                    +{result.tags.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/documents/${result.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Open Document →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > resultsPerPage && (
              <div className="flex items-center justify-center space-x-2 mt-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Previous
                </button>

                {Array.from(
                  { length: Math.min(5, Math.ceil(total / resultsPerPage)) },
                  (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          page === currentPage
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(total / resultsPerPage)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
