const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});

router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

// Base /movies route: GET all movies and POST (create a new movie)
router.route('/movies')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movies = await Movie.find();
      res.json(movies);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching movies' });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    const { title, releaseDate, genre, actors, imageUrl } = req.body;
    if (!title || !releaseDate || !genre || !actors || actors.length === 0) {
      return res.status(400).json({ message: 'All fields are required, including at least one actor.' });
    }
    try {
      const newMovie = new Movie({ title, releaseDate, genre, actors, imageUrl });
      await newMovie.save();
      res.status(201).json({ movie: newMovie });
    } catch (err) {
      res.status(500).json({ message: 'Error saving movie' });
    }
  });

// Parameterized route using movieId (the ObjectID) for GET, PUT, DELETE of a single movie
router.route('/movies/:movieId')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = await Movie.findById(req.params.movieId);
      if (!movie) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      res.json({ movie });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching movie' });
    }
  })
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const updatedMovie = await Movie.findByIdAndUpdate(req.params.movieId, req.body, { new: true });
      if (!updatedMovie) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      res.json({ message: 'Movie updated successfully', updatedMovie });
    } catch (err) {
      res.status(500).json({ message: 'Error updating movie' });
    }
  })
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedMovie = await Movie.findByIdAndDelete(req.params.movieId);
      if (!deletedMovie) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      res.json({ message: 'Movie deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Error deleting movie' });
    }
  });

app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only
