const Blog = require('../models/Blog');

// Obtener todas las noticias (Admin)
exports.getBlogsAdmin = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        res.status(200).json(blogs);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener noticias', error: error.message });
    }
};

// Obtener noticias activas (Público)
exports.getBlogsPublic = async (req, res) => {
    try {
        const blogs = await Blog.find({ active: true }).sort({ createdAt: -1 });
        res.status(200).json(blogs);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener noticias', error: error.message });
    }
};

// Crear noticia
exports.createBlog = async (req, res) => {
    try {
        const { title, content, image, author, active } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ message: 'El título y el contenido son obligatorios' });
        }

        const newBlog = new Blog({
            title,
            content,
            image,
            author,
            active: active !== undefined ? active : true
        });

        await newBlog.save();
        res.status(201).json(newBlog);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la noticia', error: error.message });
    }
};

// Actualizar noticia
exports.updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedBlog = await Blog.findByIdAndUpdate(id, updates, { new: true });
        
        if (!updatedBlog) {
            return res.status(404).json({ message: 'Noticia no encontrada' });
        }

        res.status(200).json(updatedBlog);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la noticia', error: error.message });
    }
};

// Eliminar noticia
exports.deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            return res.status(404).json({ message: 'Noticia no encontrada' });
        }

        res.status(200).json({ message: 'Noticia eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la noticia', error: error.message });
    }
};
