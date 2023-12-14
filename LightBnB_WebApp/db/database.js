const { Pool } = require("pg");
const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1`, [email])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  return pool.
    query(`SELECT * FROM users WHERE id = $1`, [id])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  return pool
    .query(`
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *;
    `, [user.name, user.email, user.password])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  return pool
    .query(`
    SELECT reservations.*, properties.*, reservations.*, avg(property_reviews.rating) AS average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY reservations.id, properties.id
    ORDER BY reservations.start_date
    LIMIT $2
    `, [guest_id, limit])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = (options, limit = 10) => {
  const queryParams = [];

  // Query that comes before the WHERE clause
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) AS average_rating
  FROM properties 
  JOIN property_reviews ON properties.id = property_id
  `;

  // Used by apiRoutes GET /properties for 'My Listings' page
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += `
    WHERE properties.owner_id = $${options.owner_id}
    `;
  }

  // Check if the city field is entered in the search
  if (!options.city) {
    if (options.minimum_price_per_night && !options.maximum_price_per_night) {
      queryParams.push(options.minimum_price_per_night * 100);
      queryString += ` WHERE properties.cost_per_night >= $${queryParams.length}`;
    }
    if (!options.minimum_price_per_night && options.maximum_price_per_night) {
      queryParams.push(options.maximum_price_per_night * 100);
      queryString += ` WHERE properties.cost_per_night <= $${queryParams.length}`;
    }
    if (options.minimum_price_per_night && options.maximum_price_per_night) {
      queryParams.push(options.minimum_price_per_night * 100, options.maximum_price_per_night * 100);
      queryString += ` WHERE properties.cost_per_night >= $${queryParams.length - 1} 
                         AND properties.cost_per_night <= $${queryParams.length}`;
    }
  }

  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += ` WHERE city LIKE $${queryParams.length} `;
  }

  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    queryString += ` AND properties.cost_per_night >= $${queryParams.length}`;
  }

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100);
    queryString += ` AND properties.cost_per_night <= $${queryParams.length}`;
  }

  // After the WHERE clause
  queryString += ` GROUP BY properties.id`;

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += `
    HAVING avg(property_reviews.rating) >= $${queryParams.length}`;
  }
  
  queryParams.push(limit);
  queryString += `
  ORDER BY properties.cost_per_night
  LIMIT $${queryParams.length};
  `;
  
  return pool
    .query(queryString, queryParams)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night * 100,  // Prices stored in the db are in cents
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ];
  const queryString = `
  INSERT INTO properties (
    owner_id, 
    title, 
    description, 
    thumbnail_photo_url, 
    cover_photo_url,
    cost_per_night,
    street,
    city,
    province,
    post_code,
    country,
    parking_spaces,
    number_of_bathrooms,
    number_of_bedrooms
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;

  return pool
    .query(queryString, queryParams)
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
