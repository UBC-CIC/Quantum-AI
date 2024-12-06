import sigV4Client from "./sigV4Client";

// Generates a signed request for authenticating GET, POST, DELETE, and PUT endpoints
export async function getSignedRequest(
  path,
  queryParams = {},
  credentials,
  method = "GET",
  body = null
) {
  const signedRequest = sigV4Client
    .newClient({
      accessKey: credentials.accessKeyId,
      secretKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      region: import.meta.env.VITE_AWS_REGION,
      endpoint: import.meta.env.VITE_API_ENDPOINT,
    })
    .signRequest({
      method: method,
      path: path,
      headers: {},
      queryParams: queryParams,
      body: body,
    });

  const fetchOptions = {
    method: method,
    headers: signedRequest.headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(signedRequest.url, fetchOptions);

  if (response.ok) {
    const responseData = await response.json();
    let formattedData;

    return { responseData, formattedData };
  } else {
    
    throw new Error(response.statusText);
  }
}

// For a GET request
// const getResponse = await getSignedRequest('/path', { queryParam1: 'value1' }, credentials);

// For a POST request
// const postResponse = await getSignedRequest('/path', {}, credentials, 'POST', { key: 'value' });

// For a DELETE request
// const deleteResponse = await getSignedRequest('/path', {}, credentials, 'DELETE');

// For a PUT request
// const putResponse = await getSignedRequest('/path', {}, credentials, 'PUT', { key: 'newValue' });
