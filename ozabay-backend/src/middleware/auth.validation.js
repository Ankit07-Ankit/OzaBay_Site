import joi from "joi";

const registerValidation = (req, res, next) => {
  const schema = joi.object({
    name: joi.string().min(3).max(30).required(),
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
    accountType: joi.string().valid("user", "vendor").default("user"),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

const verifyEmailValidation = (req, res, next) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    otp: joi.string().length(6).pattern(/^[0-9]+$/).required(),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

const requestPasswordResetValidation = (req, res, next) => {
  const schema = joi.object({
    email: joi.string().email().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const resetPasswordValidation = (req, res, next) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    otp: joi.string().length(6).pattern(/^[0-9]+$/).required(),
    password: joi.string().min(6).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const productReviewParamsValidation = (req, res, next) => {
  const schema = joi.object({
    productId: joi.string().pattern(/^[a-zA-Z0-9_-]{1,160}$/).required(),
  });
  const { error } = schema.validate(req.params);
  if (error) {
    return res.status(400).json({ message: "Invalid product identifier" });
  }
  next();
};

const productReviewSummaryValidation = (req, res, next) => {
  const schema = joi.object({
    productIds: joi.string().max(8000).required(),
  });
  const { error, value } = schema.validate(req.query);
  const productIds = value?.productIds.split(",");
  if (
    error
    || productIds.length > 50
    || productIds.some((productId) => !/^[a-zA-Z0-9_-]{1,160}$/.test(productId))
  ) {
    return res.status(400).json({ message: "Provide up to 50 valid product identifiers" });
  }
  next();
};

const productReviewValidation = (req, res, next) => {
  const schema = joi.object({
    rating: joi.number().integer().min(1).max(5).required(),
    feedback: joi.string().trim().min(5).max(1000).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const loginValidation = (req, res, next) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

const deliveryLocationSchema = joi.object({
  _id: joi.string().hex().length(24),
  building: joi.string().trim().min(1).max(100).required(),
  area: joi.string().trim().min(1).max(100).required(),
  city: joi.string().trim().min(1).max(60).required(),
  state: joi.string().trim().min(1).max(60).required(),
  pincode: joi.string().trim().pattern(/^[0-9]{6}$/).required(),
  fullName: joi.string().trim().min(1).max(60).required(),
  mobile: joi.string().trim().pattern(/^[0-9]{10}$/).required(),
  alternateMobile: joi.string().trim().pattern(/^[0-9]{10}$/).allow(""),
  address: joi.string().trim().min(1).max(300),
  locality: joi.string().trim().max(100).allow(""),
  mapLink: joi.string().trim().max(2000).allow(""),
  latitude: joi.number().min(-90).max(90),
  longitude: joi.number().min(-180).max(180),
});

const profileValidation = (req, res, next) => {
  const schema = joi.object({
    name: joi.string().min(3).max(30),
    email: joi.string().email(),
    currentPassword: joi.string().min(6),
    password: joi.string().min(6),
    deliveryLocation: deliveryLocationSchema.min(1).allow(null),
    deliveryLocations: joi.array().items(deliveryLocationSchema).max(20),
    activeLocationIndex: joi.number().integer().min(0).max(19).allow(null),
  }).min(1);

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  if (
    req.body.deliveryLocations !== undefined
    && req.body.activeLocationIndex === undefined
  ) {
    return res.status(400).json({ message: "Select a default delivery location" });
  }
  if (req.body.password && !req.body.currentPassword) {
    return res.status(400).json({ message: "Enter your current password to set a new password" });
  }
  if (
    req.body.activeLocationIndex !== undefined
    && req.body.deliveryLocations !== undefined
    && (
      (req.body.deliveryLocations.length === 0 && req.body.activeLocationIndex !== null)
      || (
        req.body.deliveryLocations.length > 0
        && (
          req.body.activeLocationIndex === null
          || req.body.activeLocationIndex >= req.body.deliveryLocations.length
        )
      )
    )
  ) {
    return res.status(400).json({ message: "Select a valid saved delivery location" });
  }
  const hasLatitude = req.body.deliveryLocation?.latitude !== undefined;
  const hasLongitude = req.body.deliveryLocation?.longitude !== undefined;
  const locationsHaveIncompleteCoordinates = (req.body.deliveryLocations || []).some(
    (location) =>
      (location.latitude !== undefined) !== (location.longitude !== undefined),
  );
  if (hasLatitude !== hasLongitude || locationsHaveIncompleteCoordinates) {
    return res.status(400).json({ message: "Both location coordinates are required" });
  }

  next();
};

const userProductValidation = (req, res, next) => {
  const schema = joi.object({
    type: joi.string().valid("cart", "favorites").required(),
    products: joi
      .array()
      .items(
        joi.alternatives(
          joi.string().max(120),
          joi.number(),
          joi.object({
            id: joi.alternatives(joi.string().max(120), joi.number()).required(),
            qty: joi.number().integer().min(1).max(999),
          }).unknown(true),
        ),
      )
      .max(200)
      .required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const userProductListValidation = (req, res, next) => {
  if (req.query.type !== undefined && !["cart", "favorites"].includes(req.query.type)) {
    return res.status(400).json({ message: "Invalid product type" });
  }
  next();
};

export {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
  productReviewParamsValidation,
  productReviewSummaryValidation,
  productReviewValidation,
  profileValidation,
  userProductValidation,
  userProductListValidation,
};
