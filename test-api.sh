#!/bin/bash

# API Testing Script for Document Editing Application
# This script demonstrates how to test the API endpoints

# Configuration
BASE_URL="http://localhost:3000"
SESSION_TOKEN="YOUR_SESSION_TOKEN_HERE"  # Replace with your actual session token

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it to parse JSON responses."
    print_info "On macOS: brew install jq"
    print_info "On Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Check if the server is running
print_header "Checking server status"
if curl -s "$BASE_URL" > /dev/null; then
    print_success "Server is running at $BASE_URL"
else
    print_error "Server is not running at $BASE_URL"
    print_info "Please start the server with: npm run dev"
    exit 1
fi

# Test 1: Create a new document
print_header "Test 1: Creating a new document"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/documents" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=$SESSION_TOKEN" \
  -d '{
    "title": "API Test Document",
    "content": "This is a test document created via API.",
    "description": "A document created for API testing",
    "tags": ["api", "test", "document"],
    "is_public": true,
    "allow_comments": true,
    "allow_suggestions": false,
    "require_approval": false
  }')

if [ $? -eq 0 ]; then
    DOCUMENT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.document.id // empty')
    if [ -n "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
        print_success "Document created successfully with ID: $DOCUMENT_ID"
        echo "$CREATE_RESPONSE" | jq '.'
    else
        print_error "Failed to create document"
        echo "$CREATE_RESPONSE"
    fi
else
    print_error "Failed to create document"
fi

# Test 2: Get the created document
if [ -n "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
    print_header "Test 2: Getting the created document"
    GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents/$DOCUMENT_ID" \
      -H "Content-Type: application/json" \
      -H "Cookie: __session=$SESSION_TOKEN")
    
    if [ $? -eq 0 ]; then
        print_success "Document retrieved successfully"
        echo "$GET_RESPONSE" | jq '.'
    else
        print_error "Failed to retrieve document"
    fi
fi

# Test 3: Apply text changes
if [ -n "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
    print_header "Test 3: Applying text changes"
    CHANGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/documents/$DOCUMENT_ID/changes" \
      -H "Content-Type: application/json" \
      -H "Cookie: __session=$SESSION_TOKEN" \
      -d '{
        "textToReplace": "test document",
        "newText": "updated document"
      }')
    
    if [ $? -eq 0 ]; then
        print_success "Text change applied successfully"
        echo "$CHANGE_RESPONSE" | jq '.'
    else
        print_error "Failed to apply text change"
        echo "$CHANGE_RESPONSE"
    fi
fi

# Test 4: Search for documents
print_header "Test 4: Searching for documents"
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/search?q=API+Test" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=$SESSION_TOKEN")

if [ $? -eq 0 ]; then
    print_success "Search completed successfully"
    echo "$SEARCH_RESPONSE" | jq '.'
else
    print_error "Failed to search documents"
fi

# Test 5: Get all documents
print_header "Test 5: Getting all documents"
DOCUMENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=$SESSION_TOKEN")

if [ $? -eq 0 ]; then
    print_success "Documents retrieved successfully"
    echo "$DOCUMENTS_RESPONSE" | jq '.'
else
    print_error "Failed to retrieve documents"
fi

# Test 6: Update document metadata
if [ -n "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
    print_header "Test 6: Updating document metadata"
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/documents/$DOCUMENT_ID" \
      -H "Content-Type: application/json" \
      -H "Cookie: __session=$SESSION_TOKEN" \
      -d '{
        "title": "Updated API Test Document",
        "description": "Updated description after API testing",
        "tags": ["api", "test", "updated"],
        "is_public": false
      }')
    
    if [ $? -eq 0 ]; then
        print_success "Document metadata updated successfully"
        echo "$UPDATE_RESPONSE" | jq '.'
    else
        print_error "Failed to update document metadata"
        echo "$UPDATE_RESPONSE"
    fi
fi

# Test 7: Get public documents only
print_header "Test 7: Getting public documents only"
PUBLIC_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents?public=true" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=$SESSION_TOKEN")

if [ $? -eq 0 ]; then
    print_success "Public documents retrieved successfully"
    echo "$PUBLIC_RESPONSE" | jq '.'
else
    print_error "Failed to retrieve public documents"
fi

# Test 8: Error handling - Invalid document ID
print_header "Test 8: Testing error handling with invalid document ID"
ERROR_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents/invalid-id" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=$SESSION_TOKEN")

if [ $? -eq 0 ]; then
    print_info "Error response received (expected)"
    echo "$ERROR_RESPONSE" | jq '.'
else
    print_error "Unexpected error occurred"
fi

# Test 9: Error handling - Unauthorized access
print_header "Test 9: Testing unauthorized access"
UNAUTHORIZED_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/documents/$DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unauthorized Update"
  }')

if [ $? -eq 0 ]; then
    print_info "Unauthorized response received (expected)"
    echo "$UNAUTHORIZED_RESPONSE" | jq '.'
else
    print_error "Unexpected error occurred"
fi

# Test 10: Clean up - Delete the test document
if [ -n "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
    print_header "Test 10: Cleaning up - Deleting test document"
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/documents/$DOCUMENT_ID" \
      -H "Content-Type: application/json" \
      -H "Cookie: __session=$SESSION_TOKEN")
    
    if [ $? -eq 0 ]; then
        print_success "Test document deleted successfully"
        echo "$DELETE_RESPONSE" | jq '.'
    else
        print_error "Failed to delete test document"
        echo "$DELETE_RESPONSE"
    fi
fi

print_header "API Testing Complete"
print_info "Check the responses above for any errors or issues."
print_info "Make sure to replace YOUR_SESSION_TOKEN_HERE with your actual session token."
