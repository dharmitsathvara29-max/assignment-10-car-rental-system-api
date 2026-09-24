const supabase = require('../config/supabase');

/**
 * Book a vehicle with collision prevention and dynamic cost computation
 * POST /api/rentals
 * Protected (requires Supabase JWT)
 */
const bookRental = async (req, res, next) => {
  try {
    const { vehicle_id, start_date, end_date, customer_name, customer_email } = req.body;

    // a) Validate required fields
    if (!vehicle_id || !start_date || !end_date || !customer_name || !customer_email) {
      return res.status(400).json({
        success: false,
        message: 'vehicle_id, start_date, end_date, customer_name, and customer_email are required',
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Dates must be in YYYY-MM-DD format',
      });
    }

    const start = new Date(start_date + 'T00:00:00Z');
    const end = new Date(end_date + 'T00:00:00Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_date or end_date provided',
      });
    }

    // Validate end_date >= start_date
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'end_date must be greater than or equal to start_date',
      });
    }

    // Validate vehicle exists
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle_id)
      .maybeSingle();

    if (vehicleError) {
      return res.status(400).json({
        success: false,
        message: vehicleError.message,
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    if (vehicle.status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is currently under maintenance and cannot be booked',
      });
    }

    // b) COLLISION CHECK:
    // Query rentals for the same vehicle_id where status is 'booked' or 'active'
    // and date range overlaps: existing.start_date <= new.end_date AND existing.end_date >= new.start_date
    const { data: conflictingRentals, error: collisionError } = await supabase
      .from('rentals')
      .select('id, start_date, end_date, status')
      .eq('vehicle_id', vehicle_id)
      .in('status', ['booked', 'active'])
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (collisionError) {
      return res.status(400).json({
        success: false,
        message: collisionError.message,
      });
    }

    if (conflictingRentals && conflictingRentals.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle already reserved during this timeframe',
      });
    }

    // c) COST CALCULATION:
    // compute number of days as (end_date - start_date in days), minimum 1 day, multiply by daily_rate
    const diffTime = end.getTime() - start.getTime();
    const rawDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const rentalDays = Math.max(1, rawDays);
    const total_cost = Number((rentalDays * Number(vehicle.daily_rate)).toFixed(2));

    // d) Insert the rental with user_id from req.user, status 'booked'
    const { data: newRental, error: insertError } = await supabase
      .from('rentals')
      .insert([
        {
          user_id: req.user.id,
          vehicle_id: Number(vehicle_id),
          customer_name: customer_name.trim(),
          customer_email: customer_email.trim(),
          start_date,
          end_date,
          total_cost,
          status: 'booked',
        },
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({
        success: false,
        message: insertError.message,
      });
    }

    // e) Update the vehicle's status to 'rented'
    const { error: updateVehicleError } = await supabase
      .from('vehicles')
      .update({ status: 'rented' })
      .eq('id', vehicle_id);

    if (updateVehicleError) {
      console.warn('Warning: Could not update vehicle status to rented:', updateVehicleError.message);
    }

    // f) Return 201 with the created rental
    return res.status(201).json({
      success: true,
      message: 'Rental booked successfully',
      data: {
        ...newRental,
        rental_days: rentalDays,
        daily_rate: Number(vehicle.daily_rate),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List current user's rental history
 * GET /api/rentals/my-bookings
 * Protected (requires Supabase JWT)
 */
const getMyBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('rentals')
      .select('*, vehicle:vehicles(id, brand, model, year, category, daily_rate, fuel_type, seating_capacity)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      count: data ? data.length : 0,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel an upcoming rental
 * PATCH /api/rentals/:id/cancel
 * Protected (only owner can cancel, status must be 'booked')
 */
const cancelRental = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rental ID provided',
      });
    }

    // Query the rental
    const { data: rental, error: fetchError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({
        success: false,
        message: fetchError.message,
      });
    }

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental not found',
      });
    }

    // Check ownership
    if (rental.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this rental booking',
      });
    }

    // Only allow cancelling if status is 'booked'
    if (rental.status !== 'booked') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel rental with status '${rental.status}'. Only 'booked' rentals can be cancelled.`,
      });
    }

    // Update rental status to 'cancelled'
    const { data: updatedRental, error: cancelError } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (cancelError) {
      return res.status(400).json({
        success: false,
        message: cancelError.message,
      });
    }

    // Set the vehicle's status back to 'available'
    const { error: vehicleUpdateError } = await supabase
      .from('vehicles')
      .update({ status: 'available' })
      .eq('id', rental.vehicle_id);

    if (vehicleUpdateError) {
      console.warn('Warning: Could not reset vehicle status to available:', vehicleUpdateError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Rental cancelled successfully and vehicle released',
      data: updatedRental,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark rental returned / completed and restore vehicle to available
 * PATCH /api/rentals/:id/complete
 * Protected
 */
const completeRental = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rental ID provided',
      });
    }

    const { data: rental, error: fetchError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({
        success: false,
        message: fetchError.message,
      });
    }

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental not found',
      });
    }

    if (rental.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Rental is already completed',
      });
    }

    if (rental.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a cancelled rental',
      });
    }

    // Mark rental as completed
    const { data: updatedRental, error: completeError } = await supabase
      .from('rentals')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (completeError) {
      return res.status(400).json({
        success: false,
        message: completeError.message,
      });
    }

    // Set the vehicle's status back to 'available'
    const { error: vehicleUpdateError } = await supabase
      .from('vehicles')
      .update({ status: 'available' })
      .eq('id', rental.vehicle_id);

    if (vehicleUpdateError) {
      console.warn('Warning: Could not reset vehicle status to available:', vehicleUpdateError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Rental completed successfully and vehicle returned to available fleet',
      data: updatedRental,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  bookRental,
  getMyBookings,
  cancelRental,
  completeRental,
};
