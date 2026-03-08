// Consistent JSON shape for Flutter/mobile: always include success, message, and data (or errors)
export const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
  const payload = {
    success: true,
    message: typeof message === 'string' ? message : 'Success',
    data: data !== undefined ? data : null
  };
  return res.status(statusCode).set('Content-Type', 'application/json').json(payload);
};

export const errorResponse = (res, statusCode = 400, message = 'Error', errors = null) => {
  const payload = {
    success: false,
    message: typeof message === 'string' ? message : 'Error',
    data: null,
    ...(errors != null && { errors })
  };
  return res.status(statusCode).set('Content-Type', 'application/json').json(payload);
};

export default { successResponse, errorResponse };

