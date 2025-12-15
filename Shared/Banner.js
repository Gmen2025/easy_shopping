import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, Dimensions, ScrollView, ActivityIndicator, Text } from "react-native";
import Swiper from 'react-native-swiper';
import axios from 'axios';
import baseUrl from '../assets/common/baseUrl';

var {width} = Dimensions.get("window");

const Banner = () => {
    const [bannerData, setBannerData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchFeaturedProducts();

        return () => {
            setBannerData([]);
        }
    }, []);

    const fetchFeaturedProducts = async () => {
        try {
            setLoading(true);
            setError(null);

            // Try multiple API approaches to get featured products
            let response;
            let featuredProducts = [];

            try {
                // Method 1: Query parameter
                response = await axios.get(`${baseUrl}products`, {
                    params: { isFeatured: true }
                });
                console.log('Method 1 - Query params response:', response.data);
                featuredProducts = response.data;
            } catch (error) {
                console.log('Method 1 failed, trying method 2');
                
                try {
                    // Method 2: Direct URL parameter
                    response = await axios.get(`${baseUrl}products?isFeatured=true`);
                    console.log('Method 2 - URL params response:', response.data);
                    featuredProducts = response.data;
                } catch (error) {
                    console.log('Method 2 failed, trying method 3');
                    
                    // Method 3: Get all products and filter client-side
                    response = await axios.get(`${baseUrl}products`);
                    console.log('Method 3 - All products response:', response.data.length, 'products');
                    featuredProducts = response.data.filter(product => {
                        console.log(`Product ${product.name}: isFeatured = ${product.isFeatured}`);
                        return product.isFeatured === true;
                    });
                }
            }

            console.log('Featured products found:', featuredProducts.length);

            if (featuredProducts && featuredProducts.length > 0) {
                // Filter and extract only featured products with images
                const filteredFeatured = featuredProducts.filter(product => {
                    const isFeatured = product.isFeatured === true;
                    const hasImage = product.image || (product.images && product.images.length > 0);
                    
                    console.log(`Product: ${product.name}, isFeatured: ${isFeatured}, hasImage: ${hasImage}`);
                    
                    return isFeatured && hasImage;
                });

                console.log('Filtered featured products with images:', filteredFeatured.length);

                // Extract image URLs from the featured products
                const featuredImages = filteredFeatured.map(product => {
                    const imageUrl = product.image || product.images?.[0];
                    console.log(`Using image for ${product.name}: ${imageUrl}`);
                    return imageUrl;
                }).filter(image => image && image.trim() !== ''); // Remove null/empty images

                console.log('Final banner images:', featuredImages);

                if (featuredImages.length > 0) {
                    setBannerData(featuredImages);
                } else {
                    console.log('No valid featured images found, using defaults');
                    setBannerData(getDefaultBanners());
                }
            } else {
                console.log('No featured products found, using default banners');
                setBannerData(getDefaultBanners());
            }
        } catch (error) {
            console.error('Error fetching featured products:', error);
            setError(error.message);
            setBannerData(getDefaultBanners());
        } finally {
            setLoading(false);
        }
    };

    const getDefaultBanners = () => {
        return [
            'https://static1.squarespace.com/static/5a51022ff43b55247f47ccfc/5a567854f9619a96fd6233bb/5b74446c40ec9afbc633e555/1534346950637/Husqvarna+545FR+%282%29.png?format=1500w',
            'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png',
            'https://static1.squarespace.com/static/5a51022ff43b55247f47ccfc/5a567854f9619a96fd6233bb/5b74446c40ec9afbc633e555/1534346950637/Husqvarna+545FR+%282%29.png?format=1500w'
        ];
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading featured products...</Text>
            </View>
        );
    }

    if (error && bannerData.length === 0) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load banners</Text>
            </View>
        );
    }

    return (
        <ScrollView>
            <View style={styles.container}>
                <View style={styles.swiper}>
                    <Swiper 
                        style={{height: width/2}} 
                        showButtons={false} 
                        autoplay={true} 
                        autoplayTimeout={3}
                        dot={<View style={styles.dot} />}
                        activeDot={<View style={styles.activeDot} />}
                        paginationStyle={styles.pagination}
                    >
                        {bannerData.map((item, index) => {
                            return(
                                <Image
                                    key={`banner_${index}`}
                                    resizeMode="contain"
                                    source={{uri: item}}
                                    style={styles.imageBanner}
                                    onError={(error) => {
                                        console.log('Image load error:', error.nativeEvent.error);
                                    }}
                                />
                            )
                        })}
                    </Swiper>
                    <View style={{height: 20}}></View>
                </View>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'gainsboro',
    },
    swiper: {
        width: width,
        alignItems: 'center',
        marginTop: 10
    },
    imageBanner: {
        height: width/2,
        width: width - 40,
        borderRadius: 10,
        marginHorizontal: 20,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        height: width/2 + 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'gainsboro',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        height: width/2 + 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'gainsboro',
    },
    errorText: {
        fontSize: 16,
        color: '#ff0000',
    },
    dot: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 3,
        marginRight: 3,
        marginTop: 3,
        marginBottom: 3,
    },
    activeDot: {
        backgroundColor: '#fff',
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 3,
        marginRight: 3,
        marginTop: 3,
        marginBottom: 3,
    },
    pagination: {
        bottom: 10,
    },
})

export default Banner;