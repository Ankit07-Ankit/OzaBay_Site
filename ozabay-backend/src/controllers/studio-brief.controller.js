import Joi from "joi";
import mongoose from "mongoose";
import multer from "multer";
import StudioBrief from "../models/studio-brief.model.js";
import { isValidVendorProductMediaSignature } from "../services/vendor-product-media.service.js";

const optionalText = (max) => Joi.string().trim().max(max).allow("").default("");
const briefSchema = Joi.object({
  customer: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().email().max(254).required(),
    phone: Joi.string().trim().pattern(/^[+\d][\d\s()-]{6,19}$/).required(),
    city: Joi.string().trim().max(100).required(),
    address: Joi.string().trim().min(5).max(300).required(),
    quantity: Joi.number().integer().min(1).max(50).required(),
    budget: optionalText(100), neededBy: optionalText(20), purpose: optionalText(80),
    approval: Joi.string().valid("Yes").required(),
  }).required(),
  design: Joi.object({
    form: optionalText(80), material: optionalText(80), finish: optionalText(80),
    size: optionalText(80), tone: optionalText(80), engraving: optionalText(150),
    notes: optionalText(2000),
  }).required(),
}).required();

const readUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 1, parts: 3, fileSize: 3 * 1024 * 1024, fieldSize: 16000 },
}).single("reference");

export const receiveStudioBrief = (req, res, next) => {
  readUpload(req, res, (error) => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({ message: "Use one JPG, PNG or WebP reference image up to 3 MB." });
    next();
  });
};

export const createStudioBrief = async (req, res) => {
  let input;
  try {
    input = JSON.parse(req.body?.brief);
  } catch {
    return res.status(400).json({ message: "Please include your design brief." });
  }
  const { value, error } = briefSchema.validate(input);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const file = req.file;
  if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
      || !isValidVendorProductMediaSignature(file.mimetype, file.buffer))) {
    return res.status(400).json({ message: "Choose a valid JPG, PNG or WebP image." });
  }
  const brief = await StudioBrief.create({
    ...value,
    ...(file && { referenceName: file.originalname.slice(0, 200), referenceType: file.mimetype, referenceImage: file.buffer }),
  });
  return res.status(201).json({ requestId: String(brief._id) });
};

export const getStudioReference = async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
  const brief = await StudioBrief.findById(req.params.id).select("referenceType +referenceImage");
  if (!brief?.referenceImage) return res.sendStatus(404);
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  return res.type(brief.referenceType).send(brief.referenceImage);
};
