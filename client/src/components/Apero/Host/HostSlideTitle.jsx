import { motion } from 'framer-motion';

const HostSlideTitle = ({ slide }) => {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            color: 'white',
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            position: 'relative',
            background: 'rgba(0,0,0,0.2)' // Slight overlay if needed
        }}>
            <motion.h1
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 10 }}
                style={{
                    fontSize: '6rem',
                    fontWeight: 900,
                    marginBottom: '2rem',
                    background: 'linear-gradient(to right, #fff, #a5b4fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}
            >
                {slide.title}
            </motion.h1>

            {slide.subtitle && (
                <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    style={{
                        fontSize: '3rem',
                        fontWeight: 300,
                        opacity: 0.9
                    }}
                >
                    {slide.subtitle}
                </motion.h3>
            )}

            {/* Decorative Element */}
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: '200px' }}
                transition={{ delay: 0.4, duration: 0.8 }}
                style={{
                    height: '4px',
                    background: 'white',
                    marginTop: '2rem',
                    borderRadius: '2px'
                }}
            />
        </div>
    );
};

export default HostSlideTitle;
