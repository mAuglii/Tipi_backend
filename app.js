require('dotenv').config();
const cors = require('cors');


const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');


const authRoutes = require('./routes/auth');
const spotsRouter = require('./routes/spots');
const bookingsRouter = require('./routes/bookings');
const reviewsRouter = require('./routes/reviews');
const availabilityRouter = require('./routes/availability');




const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');


const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: 'http://localhost:5173', // your Vue frontend
  credentials: true
}));


app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRoutes);
app.use('/spots', spotsRouter);
app.use('/bookings', bookingsRouter);
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/reviews', reviewsRouter);
app.use('/availability', availabilityRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
