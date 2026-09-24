const supabase = require('../config/supabase');

const VALID_CATEGORIES = ['Sedan', 'SUV', 'Luxury', 'Hatchback', 'Electric'];
const VALID_STATUSES = ['available', 'rented', 'maintenance'];

/**
 * List all vehicles with optional filters (?category=&status=)
 * GET /api/vehicles
 */
const getAllVehicles = async (req, res, next) => {
  try {
    const { category, status } = req.query;

    let query = supabase.from('vehicles').select('*');

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category filter. Allowed values: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      query = query.eq('category', category);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter. Allowed values: ${VALID_STATUSES.join(', ')}`,
        });
      }
      query = query.eq('status', status);
    }

    query = query.order('id', { ascending: true });

    const { data, error } = await query;

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
 * Get vehicle details plus past rentals (relational join)
 * GET /api/vehicles/:id
 */
const getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID provided',
      });
    }

    // Join vehicles with rentals using PostgREST foreign key relationship
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, rentals(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a new vehicle (admin / protected)
 * POST /api/vehicles
 */
const createVehicle = async (req, res, next) => {
  try {
    const { brand, model, year, category, daily_rate, fuel_type, seating_capacity, status } = req.body;

    // Validate required fields
    if (!brand || !model || !year || !category || daily_rate === undefined || !fuel_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: brand, model, year, category, daily_rate, fuel_type are required',
      });
    }

    // Validate category enum
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // Validate daily_rate
    const numericRate = parseFloat(daily_rate);
    if (isNaN(numericRate) || numericRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'daily_rate must be a positive number greater than 0',
      });
    }

    // Validate year
    const numericYear = parseInt(year, 10);
    if (isNaN(numericYear) || numericYear < 1900 || numericYear > new Date().getFullYear() + 2) {
      return res.status(400).json({
        success: false,
        message: 'year must be a valid four-digit year',
      });
    }

    // Validate seating_capacity if provided
    let seats = 5;
    if (seating_capacity !== undefined) {
      seats = parseInt(seating_capacity, 10);
      if (isNaN(seats) || seats <= 0) {
        return res.status(400).json({
          success: false,
          message: 'seating_capacity must be a positive integer',
        });
      }
    }

    // Validate status if provided
    let vehicleStatus = 'available';
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      vehicleStatus = status;
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          brand: brand.trim(),
          model: model.trim(),
          year: numericYear,
          category,
          daily_rate: numericRate,
          fuel_type: fuel_type.trim(),
          seating_capacity: seats,
          status: vehicleStatus,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update vehicle daily_rate and/or status
 * PUT /api/vehicles/:id
 */
const updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { daily_rate, status, brand, model, year, category, fuel_type, seating_capacity } = req.body;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID provided',
      });
    }

    // Check if vehicle exists
    const { data: existing, error: checkError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      return res.status(400).json({
        success: false,
        message: checkError.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    const updates = {};

    if (daily_rate !== undefined) {
      const numericRate = parseFloat(daily_rate);
      if (isNaN(numericRate) || numericRate <= 0) {
        return res.status(400).json({
          success: false,
          message: 'daily_rate must be a positive number greater than 0',
        });
      }
      updates.daily_rate = numericRate;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      updates.status = status;
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      updates.category = category;
    }

    if (brand !== undefined) updates.brand = brand.trim();
    if (model !== undefined) updates.model = model.trim();
    if (year !== undefined) updates.year = parseInt(year, 10);
    if (fuel_type !== undefined) updates.fuel_type = fuel_type.trim();
    if (seating_capacity !== undefined) updates.seating_capacity = parseInt(seating_capacity, 10);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (e.g. daily_rate or status) is required to update',
      });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a vehicle
 * Block deletion (400) if the vehicle has any rentals with status 'booked' or 'active'
 * DELETE /api/vehicles/:id
 */
const deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID provided',
      });
    }

    // Check if vehicle exists
    const { data: vehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      return res.status(400).json({
        success: false,
        message: checkError.message,
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    // Check for any active or booked rentals
    const { data: activeRentals, error: rentalError } = await supabase
      .from('rentals')
      .select('id, status')
      .eq('vehicle_id', id)
      .in('status', ['booked', 'active']);

    if (rentalError) {
      return res.status(400).json({
        success: false,
        message: rentalError.message,
      });
    }

    if (activeRentals && activeRentals.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle with active or booked rentals',
      });
    }

    // Safe to delete
    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(400).json({
        success: false,
        message: deleteError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
